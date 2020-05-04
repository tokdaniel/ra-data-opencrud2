import {
  GET_LIST,
  GET_MANY,
  GET_MANY_REFERENCE,
  CREATE,
  UPDATE,
  DELETE
} from 'ra-core/lib/dataFetchActions';
import buildVariables from './buildVariables';
import { TypeKind } from 'graphql/type/introspection';
import { IntrospectionResult, Resource } from './constants/interfaces';

describe('buildVariables', () => {
  describe('GET_LIST', () => {
    it('returns correct variables', () => {
      const introspectionResult = {
        types: [
          {
            kind: 'INPUT_OBJECT',
            name: 'PostWhereInput',
            inputFields: [{ name: 'tags_some', type: { kind: '', name: '' } }]
          }
        ]
      };
      const params = {
        filter: {
          ids: ['foo1', 'foo2'],
          tags: { id: ['tag1', 'tag2'] },
          'author.id': 'author1',
          views: 100
        },
        pagination: { page: 10, perPage: 10 },
        sort: { field: 'sortField', order: 'DESC' }
      };

      expect(
        buildVariables(introspectionResult as unknown as IntrospectionResult)(
          { type: { name: 'Post' } } as Resource,
          GET_LIST,
          params
        )
      ).toEqual({
        where: {
          id_in: ['foo1', 'foo2'],
          tags_some: { id_in: ['tag1', 'tag2'] },
          author: { id: 'author1' },
          views: 100
        },
        first: 10,
        orderBy: 'sortField_DESC',
        skip: 90
      });
    });
  });

  describe('CREATE', () => {
    it('returns correct variables', () => {
      const introspectionResult = {
        types: [
          {
            name: 'Post',
            fields: [
              {
                name: 'title'
              }
            ]
          },
          {
            name: 'PostCreateInput',
            kind: TypeKind.INPUT_OBJECT,
            inputFields: [
              {
                name: 'author',
                type: {
                  kind: TypeKind.NON_NULL,
                  ofType: {
                    kind: TypeKind.INPUT_OBJECT,
                    name: 'AuthorCreateOneInput'
                  }
                }
              },
              {
                name: 'tags',
                type: {
                  kind: TypeKind.NON_NULL,
                  ofType: {
                    kind: TypeKind.INPUT_OBJECT,
                    name: 'TagCreateManyInput'
                  }
                }
              },
              {
                name: 'title',
                type: {
                  kind: TypeKind.NON_NULL,
                  ofType: {
                    kind: TypeKind.SCALAR,
                    name: 'String'
                  }
                }
              }
            ]
          },
          {
            name: 'AuthorCreateOneInput',
            kind: TypeKind.INPUT_OBJECT,
            inputFields: [
              {
                name: 'connect',
                type: {
                  kind: TypeKind.NON_NULL,
                  ofType: {
                    kind: TypeKind.INPUT_OBJECT,
                    name: 'AuthorWhereUniqueInput'
                  }
                }
              }
            ]
          },
          {
            name: 'AuthorWhereUniqueInput',
            kind: TypeKind.INPUT_OBJECT,
            inputFields: [
              {
                name: 'id',
                type: {
                  kind: TypeKind.SCALAR,
                  name: 'String'
                }
              }
            ]
          },
          {
            name: 'TagCreateManyInput',
            kind: TypeKind.INPUT_OBJECT,
            inputFields: [
              {
                name: 'connect',
                type: {
                  kind: TypeKind.NON_NULL,
                  ofType: {
                    kind: TypeKind.INPUT_OBJECT,
                    name: 'TagWhereUniqueInput'
                  }
                }
              }
            ]
          },
          {
            name: 'TagWhereUniqueInput',
            kind: TypeKind.INPUT_OBJECT,
            inputFields: [
              {
                name: 'id',
                type: {
                  kind: TypeKind.SCALAR,
                  name: 'String'
                }
              }
            ]
          }
        ]
      };

      const params = {
        data: {
          author: { id: 'author1' },
          title: 'Foo',
          tags: [{ id: 'tags1' }, { id: 'tags2' }],
          tagsIds: ['tags1', 'tags2']
        }
      };

      expect(
        buildVariables(introspectionResult as unknown as IntrospectionResult)(
          { type: { name: 'Post' } } as Resource,
          CREATE,
          params
        )
      ).toEqual({
        data: {
          author: { connect: { id: 'author1' } },
          tags: {
            connect: [{ id: 'tags1' }, { id: 'tags2' }]
          },
          title: 'Foo'
        }
      });
    });
  });

  describe('UPDATE', () => {
    it('returns correct variables 1', () => {
      const introspectionResult = require('./mock/introspectionResults.json') as IntrospectionResult

      const params = require('./mock/page.data.json')


      const actualResult = buildVariables(introspectionResult)(
        { type: { name: 'Page' } } as Resource,
        UPDATE,
        params
      )

      expect(actualResult).toMatchSnapshot();
    });

    it('returns correct variables 2', () => {
      const introspectionResult = require('./mock/introspectionResults-2.json') as IntrospectionResult

      const params = require('./mock/company.data.json')


      const actualResult = buildVariables(introspectionResult)(
        { type: { name: 'Company' } } as Resource,
        UPDATE,
        params
      )

      expect(actualResult).toMatchSnapshot();
    });
  });

  describe('GET_MANY', () => {
    it('returns correct variables', () => {
      const params = {
        ids: ['tag1', 'tag2']
      };

      expect(
        buildVariables({} as IntrospectionResult)(
          { type: { name: 'Post' } } as Resource,
          GET_MANY,
          params
        )
      ).toEqual({
        where: { id_in: ['tag1', 'tag2'] }
      });
    });
  });

  describe('GET_MANY_REFERENCE', () => {
    it('returns correct variables', () => {
      const params = {
        target: 'author.id',
        id: 'author1'
      };

      expect(
        buildVariables({} as IntrospectionResult)(
          { type: { name: 'Post' } } as Resource,
          GET_MANY_REFERENCE,
          params
        )
      ).toEqual({
        where: { author: { id: 'author1' } }
      });
    });
  });

  describe('DELETE', () => {
    it('returns correct variables', () => {
      const params = {
        id: 'post1'
      };

      expect(
        buildVariables({} as IntrospectionResult)(
          { type: { name: 'Post', inputFields: [] } } as any,
          DELETE,
          params
        )
      ).toEqual({
        where: { id: 'post1' }
      });
    });
  });
});
