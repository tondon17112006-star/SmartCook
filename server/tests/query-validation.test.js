import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPagination,
  escapeLike,
  parsePagination,
  readPositiveInt,
  readSearch,
  readString,
} from '../src/utilities/query.js';

const isBadRequest = (error) => error.status === 400;

test('query integers reject coercion, repeated values and values outside SQL INT', () => {
  for (const value of ['', '0', '-1', '1.5', '1e2', '01', ' 1 ', '2147483648', ['1', '2'], {}, 1]) {
    assert.throws(() => readPositiveInt(value, 'id'), isBadRequest, `Invalid value: ${JSON.stringify(value)}`);
  }
  assert.equal(readPositiveInt('2147483647', 'id'), 2_147_483_647);
  assert.equal(readPositiveInt(undefined, 'page', { defaultValue: 1 }), 1);
});

test('pagination bounds prevent unbounded page sizes and unsafe offsets', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(parsePagination({ page: '100000', limit: '100' }), {
    page: 100_000,
    limit: 100,
    offset: 9_999_900,
  });
  for (const query of [{ page: '100001' }, { limit: '101' }, { page: ['1', '2'] }, { limit: '0' }]) {
    assert.throws(() => parsePagination(query), isBadRequest);
  }
});

test('pagination preserves totals on empty pages and reports zero total pages for no matches', () => {
  assert.deepEqual(createPagination({ page: 3, limit: 10 }, 12), {
    page: 3, limit: 10, total: 12, totalPages: 2, hasNextPage: false, hasPreviousPage: true,
  });
  assert.deepEqual(createPagination({ page: 1, limit: 20 }, 0), {
    page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false,
  });
});

test('Vietnamese search normalizes Unicode and enforces scalar and length boundaries', () => {
  assert.equal(readSearch({ search: `  ${'trứng'.normalize('NFD')}  ` }), 'trứng');
  assert.equal(readSearch({}), '');
  assert.equal(readSearch({ search: 'x'.repeat(150) }).length, 150);
  for (const search of ['x'.repeat(151), ['trứng', 'thịt'], {}]) {
    assert.throws(() => readSearch({ search }), isBadRequest);
  }
  assert.throws(() => readString('   ', 'sort', { allowEmpty: false }), isBadRequest);
});

test('LIKE escaping treats wildcard and escape characters as literal input', () => {
  assert.equal(escapeLike('a%b_c[d]~e'), 'a~%b~_c~[d]~~e');
  assert.equal(escapeLike("trứng' OR 1=1;--"), "trứng' OR 1=1;--");
});
