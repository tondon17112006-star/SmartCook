import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createPersonalFixture } from './helpers/personal-fixture.js';
import { createPublicReviewRouter, createReviewRouter } from '../src/routes/review.routes.js';
import { createReviewRepository } from '../src/services/review.repository.js';
let f, recipeId, reviewId;
before(async () => {
  f = await createPersonalFixture({routers:({app,security,request}) => {
    const repository = createReviewRepository({request});
    app.use('/api/recipes',createPublicReviewRouter({repository}));
    app.use('/api',createReviewRouter({security,repository}));
  }});
  recipeId=Number((await (await f.request()).query('SELECT TOP(1) RecipeID AS id FROM dbo.Recipes ORDER BY RecipeID;')).recordset[0].id);
});
after(async()=> {await f?.close();});
const url=()=>`/api/recipes/${recipeId}/reviews`;
test('SQL reviews: public list empty summary; guest writes denied and private mine requires login',async()=>{
  const list=await f.guest.send(url());
  assert.equal(list.status,200); assert.deepEqual(list.body.data,[]);
  assert.deepEqual(list.body.summary,{averageRating:0,reviewCount:0});
  assert.equal((await f.guest.send(`${url()}/mine`)).status,401);
  assert.equal((await f.guest.mutate(url(),{rating:5})).status,401);
});
test('SQL reviews: create text-only payload, own duplicate409, second user contributes exact summary',async()=>{
  const comment="<img src=x onerror=alert(1)> '; DROP TABLE dbo.Recipes;--";
  const created=await f.userA.mutate(url(),{rating:5,comment});
  assert.equal(created.status,201); reviewId=created.body.data.reviewId;
  assert.equal(created.body.data.comment,comment);
  assert.equal(created.body.data.userId,f.userA.user.userId);
  assert.equal((await f.userA.mutate(url(),{rating:2})).status,409);
  assert.equal((await f.userB.mutate(url(),{rating:2,comment:null})).status,201);
  const list=await f.guest.send(`${url()}?limit=1`);
  assert.equal(list.body.data.length,1);assert.equal(list.body.pagination.total,2);
  assert.deepEqual(list.body.summary,{averageRating:3.5,reviewCount:2});
  for(const row of list.body.data){assert.equal('email' in row,false);assert.equal('passwordHash' in row,false);assert.equal('phone' in row,false);}
  assert.equal((await f.userA.send(`${url()}/mine`)).body.data.reviewId,reviewId);
});
test('SQL reviews: validation and ownership prevent overposting and cross-user edits/deletes',async()=>{
  for(const rating of [0,6,1.5,'5',null]) assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,{rating},{method:'PATCH'})).status,400);
  assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,{comment:'x'.repeat(2001)},{method:'PATCH'})).status,400);
  for(const body of [{userId:f.userB.user.userId},{recipeId:recipeId},{}, {rating:4,userId:f.userB.user.userId}]) {
    assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,body,{method:'PATCH'})).status,400);
  }
  assert.equal((await f.userB.mutate(`/api/reviews/${reviewId}`,{rating:1},{method:'PATCH'})).status,404);
  assert.equal((await f.userB.mutate(`/api/reviews/${reviewId}`,{},{method:'DELETE'})).status,404);
  assert.equal((await f.userA.send(`${url()}/mine`)).body.data.rating,5);
});
test('SQL reviews: owner edits and deletes safely with CSRF/Origin checks',async()=>{
  assert.equal((await f.userA.send(`/api/reviews/${reviewId}`,{method:'PATCH',body:{rating:4}})).status,403);
  assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,{rating:4},{method:'PATCH',headers:{Origin:'https://evil.example'}})).status,403);
  const edit=await f.userA.mutate(`/api/reviews/${reviewId}`,{rating:4,comment:'  Đã nấu thử  '},{method:'PATCH'});
  assert.equal(edit.status,200);assert.equal(edit.body.data.comment,'Đã nấu thử');
  assert.deepEqual((await f.guest.send(url())).body.summary,{averageRating:3,reviewCount:2});
  assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,{},{method:'DELETE'})).status,200);
  assert.equal((await f.userA.mutate(`/api/reviews/${reviewId}`,{},{method:'DELETE'})).status,404);
  assert.equal((await f.userA.send(`${url()}/mine`)).body.data,null);
  assert.deepEqual((await f.guest.send(url())).body.summary,{averageRating:2,reviewCount:1});
});
test('SQL reviews: expired JWT and injection IDs denied, recipes remain intact',async()=>{
  const token=f.userB.cookies.get(f.config.cookieName),claims=jwt.decode(token),time=Math.floor(Date.now()/1000);
  const expired=jwt.sign({...claims,iat:time-60,exp:time-1},f.config.jwtSecret);
  const cookies=new Map(f.userB.cookies);cookies.set(f.config.cookieName,expired);
  assert.equal((await f.userB.send(`${url()}/mine`,{cookies})).status,401);
  assert.equal((await f.guest.send('/api/recipes/1%20OR%201=1/reviews')).status,400);
  assert.equal(Number((await(await f.request()).query('SELECT COUNT_BIG(*) AS total FROM dbo.Recipes;')).recordset[0].total),20);
});
