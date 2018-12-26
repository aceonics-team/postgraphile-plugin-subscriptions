const pubSub = require("./pubsub");

const AddMutationTriggersPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields:field', (field, build, hookContext) => {
    const { pgSql: sql } = build;

    const {
      scope: {
        isRootMutation,
        pgFieldIntrospection: table,
        isPgCreateMutationField,
        isPgUpdateMutationField,
        isPgDeleteMutationField,
      },
      addArgDataGenerator,
    } = hookContext;

    if (!isRootMutation) {
      return field;
    }
    
    let mutationType, previousRecord, currentRecord;

    if (isPgCreateMutationField) {
      mutationType = 'CREATED';
    } else if (isPgUpdateMutationField) {
      mutationType = 'UPDATED';
    } else if (isPgDeleteMutationField) {
      mutationType = 'DELETED';
    } else {
      return field;
    }

    addArgDataGenerator(() => ({
      pgQuery: queryBuilder => {
        queryBuilder.select(
          sql.query`${queryBuilder.getTableAlias()}.id`,
          '__RelatedNodeId',
        );
      },
    }));

    const oldResolve = field.resolve;

    return {
      ...field,

      async resolve(_mutation, args, context, info) {
        if (isPgCreateMutationField) {
          previousRecord = null;
        } else {
          const { rows: [row] } = await context.pgClient.query(
            // TODO: Check if we can avoid using * in query
            // TODO: Does not work if mutation is done via nodeId or any other unique key
            `select * from ${table.namespaceName}.${table.name} where id = $1`,
            [args.input.id]
          );
          previousRecord = row;
        }

        const oldResolveResult = await oldResolve(_mutation, args, context, info);
        
        const relatedNodeId = oldResolveResult.data.__RelatedNodeId;

        if (isPgDeleteMutationField) {
          currentRecord = null;
        } else {
          const { rows: [row] } = await context.pgClient.query(
            // TODO: Check if we can avoid using * in query
            `select * from ${table.namespaceName}.${table.name} where id = $1`,
            [relatedNodeId]
          );
          currentRecord = row;
        }
    
        const payload = {
          clientMutationId: args.input.clientMutationId,
          mutationType,
          relatedNodeId,
          currentRecord,
          previousRecord,
          changedFields: (currentRecord && previousRecord) ?
            Object.keys(currentRecord).filter(k => currentRecord[k] !== previousRecord[k]) : []
        };
    
        // TODO: Check whether creating multiple channels for filter is correct approach or not
        pubSub.publish(`postgraphile:${table.name}`, payload);
        pubSub.publish(`postgraphile:${table.name}:${relatedNodeId}`, payload);

        return oldResolveResult;
      },
    };
  });
};

module.exports = AddMutationTriggersPlugin;