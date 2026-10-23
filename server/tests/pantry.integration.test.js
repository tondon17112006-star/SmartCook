import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createPersonalFixture } from './helpers/personal-fixture.js';
import { createPantryRouter } from '../src/routes/pantry.routes.js';
import { createPantryRepository } from '../src/services/pantry.repository.js';
let f, ingredientId, otherId, rowId, sharedCount;
before(async () => {
  f = await createPersonalFixture({ routers: ({app,security,request}) => {
    app.use('/api/pantry', createPantryRouter({security,repository:createPantryRepository({request})}));
  }});
  const data=await(await f.request()).query('SELECT TOP(2) IngredientID AS id FROM dbo.Ingredients ORDER BY IngredientID; SELECT COUNT_BIG(*) AS total FROM dbo.Ingredients;');
  [ingredientId,otherId]=data.recordsets[0].map(row=>Number(row.id));
  sharedCount=Number(data.recordsets[1][0].total);
});
after(async()=>{await f?.close();});
test('SQL pantry: guests cannot read/write; authenticated writes require CSRF and allowed Origin',async()=>{
  assert.equal((await f.guest.send('/api/pantry')).status,401);
  assert.equal((await f.guest.mutate('/api/pantry',{ingredientId})).status,401);
  assert.equal((await f.userA.send('/api/pantry',{method:'POST',body:{ingredientId}})).status,403);
  assert.equal((await f.userA.mutate('/api/pantry',{ingredientId},{headers:{Origin:'https://evil.example'}})).status,403);
});
test('SQL pantry: create, duplicate409, nullable fields and paginated owner-only catalog',async()=>{
  const created=await f.userA.mutate('/api/pantry',{ingredientId,quantity:6,unit:' quả ',expiryDate:'2030-11-01'});
  assert.equal(created.status,201);rowId=created.body.data.userIngredientId;
  assert.equal(created.body.data.quantity,6);assert.equal(created.body.data.unit,'quả');
  assert.equal(created.body.data.expiryDate,'2030-11-01');
  assert.equal((await f.userA.mutate('/api/pantry',{ingredientId})).status,409);
  const optional=await f.userA.mutate('/api/pantry',{ingredientId:otherId});
  assert.equal(optional.status,201);assert.equal(optional.body.data.quantity,null);assert.equal(optional.body.data.expiryDate,null);
  const list=await f.userA.send('/api/pantry?limit=1');
  assert.equal(list.status,200);assert.equal(list.body.pagination.total,2);assert.equal(list.body.data.length,1);
  assert.equal('userId' in list.body.data[0],false);
  assert.deepEqual((await f.userB.send('/api/pantry')).body.data,[]);
  assert.equal((await f.userB.mutate('/api/pantry',{ingredientId,quantity:2,unit:'g',expiryDate:'2000-01-01'})).status,201);
});
test('SQL pantry: quantity/date/unit validation and overposting reject before writes',async()=>{
  for(const quantity of [0,-1,1.234,'6',10000000000]) assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,{quantity},{method:'PATCH'})).status,400);
  for(const expiryDate of ['2026-02-29','2026-13-01','0000-01-01','2026-11-31','']) assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,{expiryDate},{method:'PATCH'})).status,400);
  for(const body of [{userId:f.userB.user.userId},{ingredientId:otherId},{unit:null},{unit:' '},{unit:'x'.repeat(31)},{}]) {
    assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,body,{method:'PATCH'})).status,400);
  }
  assert.equal((await f.userA.send('/api/pantry?userId=1')).status,400);
  assert.equal((await f.userA.mutate('/api/pantry',{ingredientId:2147483647})).status,404);
});
test('SQL pantry: only owner edits quantity/unit/date; calendar dates remain exact without JS timezone shifts',async()=>{
  assert.equal((await f.userB.mutate(`/api/pantry/${rowId}`,{quantity:10},{method:'PATCH'})).status,404);
  assert.equal((await f.userB.mutate(`/api/pantry/${rowId}`,{},{method:'DELETE'})).status,404);
  const updated=await f.userA.mutate(`/api/pantry/${rowId}`,{quantity:12.5,unit:'g',expiryDate:'2028-02-29'},{method:'PATCH'});
  assert.equal(updated.status,200);assert.equal(updated.body.data.quantity,12.5);assert.equal(updated.body.data.unit,'g');
  assert.equal(updated.body.data.expiryDate,'2028-02-29');
  assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,{expiryDate:'0001-01-01'},{method:'PATCH'})).body.data.expiryDate,'0001-01-01');
  const cleared=await f.userA.mutate(`/api/pantry/${rowId}`,{quantity:null,unit:null,expiryDate:null},{method:'PATCH'});
  assert.equal(cleared.status,200);assert.equal(cleared.body.data.quantity,null);assert.equal(cleared.body.data.unit,null);
  assert.equal((await f.userB.send('/api/pantry')).body.data[0].quantity,2);
});
test('SQL pantry: SQL-like unit remains literal; deletion removes only own row and preserves shared ingredients',async()=>{
  const literal="g'; SELECT 1;--";
  const edited=await f.userA.mutate(`/api/pantry/${rowId}`,{unit:literal},{method:'PATCH'});
  assert.equal(edited.status,200);assert.equal(edited.body.data.unit,literal);
  assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,{},{method:'DELETE'})).status,200);
  assert.equal((await f.userA.mutate(`/api/pantry/${rowId}`,{},{method:'DELETE'})).status,404);
  assert.equal((await f.userB.send('/api/pantry')).body.pagination.total,1);
  assert.equal(Number((await(await f.request()).query('SELECT COUNT_BIG(*) AS total FROM dbo.Ingredients;')).recordset[0].total),sharedCount);
});
test('SQL pantry: expired JWT and logged-out cookie cannot restore access',async()=>{
  const token=f.userB.cookies.get(f.config.cookieName),claims=jwt.decode(token),time=Math.floor(Date.now()/1000);
  const old=new Map(f.userB.cookies);old.set(f.config.cookieName,jwt.sign({...claims,iat:time-60,exp:time-1},f.config.jwtSecret));
  assert.equal((await f.userB.send('/api/pantry',{cookies:old})).status,401);
  const captured=new Map(f.userB.cookies);await f.userB.logout();
  assert.equal((await f.userB.send('/api/pantry',{cookies:captured})).status,401);
});
