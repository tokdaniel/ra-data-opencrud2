import {
  GET_LIST,
  GET_ONE,
  GET_MANY,
  GET_MANY_REFERENCE,
  CREATE,
  UPDATE,
  DELETE
} from 'react-admin';
import isObject from 'lodash/isObject';

import getFinalType from './utils/getFinalType';
import { computeFieldsToAddRemoveUpdate } from './utils/computeAddRemoveUpdate';

import {
  PRISMA_CONNECT,
  PRISMA_DISCONNECT,
  PRISMA_UPDATE,
  PRISMA_CREATE,
  PRISMA_DELETE,
  PRISMA_SET
} from './constants/mutations';
import {
  IntrospectionInputObjectType,
  IntrospectionObjectType,
  IntrospectionType,
  IntrospectionNamedTypeRef
} from 'graphql';
import { IntrospectionResult, Resource } from './constants/interfaces';

interface GetListParams {
  filter: { [key: string]: any };
  pagination: { page: number; perPage: number };
  sort: { field: string; order: string };
}

//TODO: Object filter weren't tested yet
const buildGetListVariables = (introspectionResults: IntrospectionResult) => (
  resource: Resource,
  aorFetchType: string,
  params: GetListParams
) => {
  const filter = Object.keys(params.filter).reduce((acc, key) => {
    if (key === 'ids') {
      return { ...acc, id_in: params.filter[key] };
    }

    if (Array.isArray(params.filter[key])) {
      const type = introspectionResults.types.find(
        t => t.name === `${resource.type.name}WhereInput`
      ) as IntrospectionInputObjectType;
      const inputField = type.inputFields.find(t => t.name === key);

      if (!!inputField) {
        return {
          ...acc,
          [key]: { id_in: params.filter[key] }
        };
      }
    }

    if (isObject(params.filter[key])) {
      const type = introspectionResults.types.find(
        t => t.name === `${resource.type.name}WhereInput`
      ) as IntrospectionInputObjectType;
      const filterSome = type.inputFields.find(t => t.name === `${key}_some`);

      if (filterSome) {
        const filter = Object.keys(params.filter[key]).reduce(
          (acc, k: string) => ({
            ...acc,
            [`${k}_in`]: params.filter[key][k] as string[]
          }),
          {} as { [key: string]: string[] }
        );
        return { ...acc, [`${key}_some`]: filter };
      }
    }

    const parts = key.split('.');

    if (parts.length > 1) {
      if (parts[1] == 'id') {
        const type = introspectionResults.types.find(
          t => t.name === `${resource.type.name}WhereInput`
        ) as IntrospectionInputObjectType;
        const filterSome = type.inputFields.find(
          t => t.name === `${parts[0]}_some`
        );

        if (filterSome) {
          return {
            ...acc,
            [`${parts[0]}_some`]: { id: params.filter[key] }
          };
        }

        return { ...acc, [parts[0]]: { id: params.filter[key] } };
      }

      const resourceField = (resource.type as IntrospectionObjectType).fields.find(
        f => f.name === parts[0]
      )!;
      if ((resourceField.type as IntrospectionNamedTypeRef).name === 'Int') {
        return { ...acc, [key]: parseInt(params.filter[key]) };
      }
      if ((resourceField.type as IntrospectionNamedTypeRef).name === 'Float') {
        return { ...acc, [key]: parseFloat(params.filter[key]) };
      }
    }

    return { ...acc, [key]: params.filter[key] };
  }, {});

  return {
    skip: (params.pagination.page - 1) * params.pagination.perPage,
    first: params.pagination.perPage,
    orderBy: `${params.sort.field}_${params.sort.order}`,
    where: filter
  };
};

const findInputFieldForType = (
  introspectionResults: IntrospectionResult,
  typeName: string,
  field: string
) => {
  const type = introspectionResults.types.find(
    t => t.name === typeName
  ) as IntrospectionInputObjectType;

  if (!type) {
    return null;
  }

  const inputFieldType = type.inputFields.find(t => t.name === field);

  return !!inputFieldType ? getFinalType(inputFieldType.type) : null;
};

const inputFieldExistsForType = (
  introspectionResults: IntrospectionResult,
  typeName: string,
  field: string
): boolean => {
  return !!findInputFieldForType(introspectionResults, typeName, field);
};

const findMutationInputType = (
  introspectionResults: IntrospectionResult,
  typeName: string,
  field: string,
  mutationType: string
) => {
  const inputType = findInputFieldForType(
    introspectionResults,
    typeName,
    field
  );
  return findInputFieldForType(
    introspectionResults,
    inputType!.name,
    mutationType
  );
};

const hasMutationInputType = (
  introspectionResults: IntrospectionResult,
  typeName: string,
  field: string,
  mutationType: string
) => {
  return Boolean(
    findMutationInputType(introspectionResults, typeName, field, mutationType)
  );
};

const buildReferenceField = ({
  inputArg,
  introspectionResults,
  typeName,
  field,
  mutationType
}: {
  inputArg: { [key: string]: any };
  introspectionResults: IntrospectionResult;
  typeName: string;
  field: string;
  mutationType: string;
}) => {
  const mutationInputType = findMutationInputType(
    introspectionResults,
    typeName,
    field,
    mutationType
  );

  if (mutationType === PRISMA_CONNECT && Array.isArray(inputArg.id)) {
    return inputArg.id.map(value => ({ id: value }))
  }

  return Object.keys(inputArg).reduce((acc, key) => {
    return inputFieldExistsForType(
      introspectionResults,
      mutationInputType!.name,
      key
    )
      ? { ...acc, [key]: inputArg[key] }
      : acc;
  }, {});
};

const buildObjectMutationData = ({
  inputArg,
  introspectionResults,
  typeName,
  key
}: {
  inputArg: { [key: string]: any };
  introspectionResults: IntrospectionResult;
  typeName: string;
  key: string;
}) => {
  const hasConnect = hasMutationInputType(
    introspectionResults,
    typeName,
    key,
    PRISMA_CONNECT
  );

  const mutationType = hasConnect ? PRISMA_CONNECT : PRISMA_CREATE;

  const fields = buildReferenceField({
    inputArg,
    introspectionResults,
    typeName,
    field: key,
    mutationType
  });

  // If no fields in the object are valid, continue
  if (Object.keys(fields).length === 0) {
    return {};
  }

  // Else, connect the nodes
  return {
    [key]: { [mutationType]: fields }
  };
};

interface UpdateParams {
  id: string;
  data: { [key: string]: any };
  previousData: { [key: string]: any };
}

const traverseVariables = (
  introspectionResults: IntrospectionResult,
  parentTypeName: String,
  params: UpdateParams,
  key: String,
  acc: any
) => {
  const parentInputType = introspectionResults.types.find(t => t.name === parentTypeName)

  if (Array.isArray(params.data[key])) {
    const previous = params.previousData[key]
    const current = params.data[key]

    // It must be created if doesnt have id
    const fieldsToCreate = current.filter(f => !f.id)
    const fieldsToDelete = previous.map(f => f.id).filter(id => !current.map(c => c.id).includes(id)).map(id => ({ id }))
    const fieldsToUpdate = current.filter(f => f.id).filter(f => !fieldsToDelete.includes(f.id))

    if (!fieldsToCreate.length && !fieldsToDelete.length && !fieldsToUpdate.length) {
      const fieldsToConnect = current.filter(f => f.id && Object.keys(f).length === 1)

      return {
        ...acc,
        data: {
          ...acc.data,
          [key]: {
            [PRISMA_SET]: fieldsToConnect
          }
        }
      };
    }

    return {
      ...acc,
      data: {
        ...acc.data,
        [key]: {
          [PRISMA_CREATE]: fieldsToCreate.map(field => {
            const typeName = findInputFieldForType(introspectionResults, parentTypeName, key)
            const type = introspectionResults.types.find(t => t.name === typeName.name)
            const createType = type.inputFields.find(t => t.name === PRISMA_CREATE)

            const finalType = getFinalType(createType.type)

            const result = Object.keys(field).reduce(
              (acc, key) => {
                return traverseVariables(introspectionResults, finalType.name, {
                  data: field,
                  previousData: {}
                }, key, acc)
            }, {})

            return result.data
          }),
          [PRISMA_UPDATE]: fieldsToUpdate.map(({ id, ...data }) => ({
            where: { id: id },
            data
          })),
          [PRISMA_DELETE]: fieldsToDelete
        }
      }
    };
  }

  if (isObject(params.data[key])) {
    if (parentInputType.kind !== 'SCALAR') {
      const data = buildObjectMutationData({
        inputArg: params.data[key],
        introspectionResults,
        typeName: parentTypeName,
        key
      });

      return {
        ...acc,
        data: {
          ...acc.data,
          ...data
        }
      };
    }
  }

  const type = introspectionResults.types.find(
    t => t.name === parentTypeName
  ) as IntrospectionObjectType;

  const isInField = type.inputFields.find(t => t.name === key);

  if (!!isInField) {
    // Rest should be put in data object
    return {
      ...acc,
      data: {
        ...acc.data,
        [key]: params.data[key]
      }
    };
  }

  return acc
}

const buildUpdateVariables = (introspectionResults: IntrospectionResult) => (
  resource: Resource,
  aorFetchType: String,
  params: UpdateParams
) => {
  return Object.keys(params.data).reduce(
    (acc, key) => {
      // Put id field in a where object
      if (key === 'id' && params.data[key]) {
        return {
          ...acc,
          where: {
            id: params.data[key]
          }
        };
      }

      const typeName = `${resource.type.name}UpdateInput`

      const inputType = findInputFieldForType(
        introspectionResults,
        typeName,
        key
      );

      if (!inputType) {
        return acc;
      }

      return traverseVariables(introspectionResults, typeName, params, key, acc);
    },
    {} as { [key: string]: any }
  );
};

interface CreateParams {
  data: { [key: string]: any };
}
const buildCreateVariables = (introspectionResults: IntrospectionResult) => (
  resource: Resource,
  aorFetchType: string,
  params: CreateParams
) =>
  Object.keys(params.data).reduce(
    (acc, key) => {
      // Put id field in a where object
      if (key === 'id' && params.data[key]) {
        return {
          ...acc,
          where: {
            id: params.data[key]
          }
        };
      }

      const inputType = findInputFieldForType(
        introspectionResults,
        `${resource.type.name}CreateInput`,
        key
      );

      if (!inputType) {
        return acc;
      }
      if (Array.isArray(params.data[key])) {
        return {
          ...acc,
          data: {
            ...acc.data,
            [key]: {
              [PRISMA_CREATE]: params.data[key]
            }
          }
        };
      }

      if (isObject(params.data[key])) {
        const inputType = findInputFieldForType(
          introspectionResults,
          `${resource.type.name}CreateInput`,
          key
        );

        if (!inputType) {
          return acc;
        }

        if (inputType.kind !== 'SCALAR') {
          const typeName = `${resource.type.name}CreateInput`;
          const data = buildObjectMutationData({
            inputArg: params.data[key],
            introspectionResults,
            typeName,
            key
          });
          return {
            ...acc,
            data: {
              ...acc.data,
              ...data
            }
          };
        }
      }

      const type = introspectionResults.types.find(
        t => t.name === resource.type.name
      ) as IntrospectionObjectType;
      const isInField = type.fields.find(t => t.name === key);

      if (isInField) {
        // Rest should be put in data object
        return {
          ...acc,
          data: {
            ...acc.data,
            [key]: params.data[key]
          }
        };
      }

      return acc;
    },
    {} as { [key: string]: any }
  );

export default (introspectionResults: IntrospectionResult) => (
  resource: Resource,
  aorFetchType: string,
  params: any
) => {
  switch (aorFetchType) {
    case GET_LIST: {
      return buildGetListVariables(introspectionResults)(
        resource,
        aorFetchType,
        params
      );
    }
    case GET_MANY:
      return {
        where: { id_in: params.ids }
      };
    case GET_MANY_REFERENCE: {
      const parts = params.target.split('.');

      return {
        where: { [parts[0]]: { id: params.id } }
      };
    }
    case GET_ONE:
      return {
        where: { id: params.id }
      };
    case UPDATE: {
      return buildUpdateVariables(introspectionResults)(
        resource,
        aorFetchType,
        params
      );
    }

    case CREATE: {
      return buildCreateVariables(introspectionResults)(
        resource,
        aorFetchType,
        params
      );
    }

    case DELETE:
      return {
        where: { id: params.id }
      };
  }
};
