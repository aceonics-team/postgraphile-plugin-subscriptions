const pubSub = require("./pubsub");

const PgMutationTriggersPlugin = (builder) => {
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

    const uniqueKeyColumns = [];
    const uniqueConstraints = table.constraints.filter(
      con => con.type === "u" || con.type === "p"
    );

    uniqueConstraints.forEach(constraint => {
      constraint.keyAttributes.forEach(key => uniqueKeyColumns.push(key.name));
    });

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
          let queryColumn;
          uniqueKeyColumns.forEach(key => {
            if (args.input[key]) {
              queryColumn = key;
            }
          });
          const { rows: [row] } = await context.pgClient.query(
            // TODO: Check if we can avoid using * in query
            `select * from ${table.namespaceName}.${table.name} where ${queryColumn} = $1`,
            [args.input[queryColumn]]
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
        if (!isPgCreateMutationField) {
          uniqueKeyColumns.forEach(key => {
            pubSub.publish(`postgraphile:${table.name}:${key}:${previousRecord[key]}`, payload);
          });
        }

        return oldResolveResult;
      },
    };
  });
};

module.exports = PgMutationTriggersPlugin;