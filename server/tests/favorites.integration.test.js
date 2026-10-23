import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createPersonalFixture } from './helpers/personal-fixture.js';
import { createFavoriteRouter } from '../src/routes/favorite.routes.js';
import { createFavoriteRepository } from '../src/services/favorite.repository.js';

let f, recipeId, otherId;
before(async () => {
  f = await createPersonalFixture({ routers: ({app,security,request}) => {
    app.use('/api/favorites', createFavoriteRouter({security,repository:createFavoriteRepository({request})}));
  } });
  const rows = (await (await f.request()).query('SELECT TOP(2) RecipeID AS id FROM dbo.Recipes ORDER BY RecipeID;')).recordset;
  [recipeId,otherId] = rows.map(row => Number(row.id));
});
after(async () => { await f?.close(); });

test('SQL favorites: guests cannot read/write personal data and authenticated writes require CSRF/Origin', async () => {
  assert.equal((await f.guest.send('/api/favorites')).status,401);
  assert.equal((await f.guest.mutate('/api/favorites',{recipeId})).status,401);
  assert.equal((await f.userA.send('/api/favorites',{method:'POST',body:{recipeId}})).status,403);
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId},{headers:{Origin:'https://evil.example'}})).status,403);
});
test('SQL favorites: add201, duplicate409 and forbidden userId400; list is owner-scoped and paginated', async () => {
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId,userId:f.userB.user.userId})).status,400);
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId})).status,201);
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId})).status,409);
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId:otherId})).status,201);
  const a = await f.userA.send('/api/favorites?limit=1');
  assert.equal(a.status,200);
  assert.equal(a.body.pagination.total,2);
  assert.equal(a.body.data[0].recipeId,otherId);
  assert.equal(typeof a.body.data[0].totalTime,'number');
  assert.equal('passwordHash' in a.body.data[0],false);
  assert.deepEqual((await f.userB.send('/api/favorites/ids')).body.data,[]);
  assert.deepEqual(new Set((await f.userA.send('/api/favorites/ids')).body.data),new Set([recipeId,otherId]));
});
test('SQL favorites: A cannot remove B favorite; deleting A own link preserves B and original Recipes', async () => {
  assert.equal((await f.userB.mutate('/api/favorites',{recipeId})).status,201);
  assert.equal((await f.userA.mutate(`/api/favorites/${recipeId}`,{userId:f.userB.user.userId},{method:'DELETE'})).status,400);
  assert.equal((await f.userA.mutate(`/api/favorites/${recipeId}`,{},{method:'DELETE'})).status,200);
  assert.equal((await f.userA.mutate(`/api/favorites/${recipeId}`,{},{method:'DELETE'})).status,404);
  assert.deepEqual((await f.userB.send('/api/favorites/ids')).body.data,[recipeId]);
  assert.equal((await f.userB.mutate(`/api/favorites/${recipeId}`,{},{method:'DELETE'})).status,200);
  const rows = (await (await f.request()).query('SELECT COUNT_BIG(*) AS total FROM dbo.Recipes;')).recordset;
  assert.equal(Number(rows[0].total),20);
});
test('SQL favorites: invalid IDs, injection and nonexistent recipes fail safely', async () => {
  for (const id of [0,-1,1.5,'1',null,"1; DROP TABLE dbo.Recipes;--"]) {
    assert.equal((await f.userA.mutate('/api/favorites',{recipeId:id})).status,400);
  }
  assert.equal((await f.userA.mutate('/api/favorites',{recipeId:2147483647})).status,404);
  assert.equal((await f.userA.send('/api/favorites?userId=1')).status,400);
});
test('SQL favorites: revoked session cannot access or mutate favorites', async () => {
  const old = new Map(f.userB.cookies);
  assert.equal((await f.userB.logout()).status,200);
  assert.equal((await f.userB.send('/api/favorites',{cookies:old})).status,401);
  assert.equal((await f.userB.mutate('/api/favorites',{recipeId},{cookies:old})).status,401);
});
