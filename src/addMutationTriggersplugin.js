const pubSub = require("./pubsub");

const AddMutationTriggersOperationHook = build => fieldContext => {
  const {
    pgSql: sql,
  } = build;

  const {
    scope: {
      isRootMutation,
      pgFieldIntrospection: table,
      isPgCreateMutationField,
      isPgUpdateMutationField,
      isPgDeleteMutationField,
    },
    addArgDataGenerator,
  } = fieldContext;

  if (!isRootMutation) return null;

  let mutationType, previousRecord, currentRecord;

  if (isPgCreateMutationField) {
    mutationType = 'CREATED';
  } else if (isPgUpdateMutationField) {
    mutationType = 'UPDATED';
  } else if (isPgDeleteMutationField) {
    mutationType = 'DELETED';
  } else {
    return null;
  }

  addArgDataGenerator(() => ({
    pgQuery: queryBuilder => {
      queryBuilder.select(
        sql.query`${queryBuilder.getTableAlias()}.id`,
        '__RelatedNodeId',
      );
    },
  }));

  const getpreviousRecord = async (input, args, context, resolveInfo) => {
    if (isPgCreateMutationField) {
      previousRecord = null;
      return input;
    } else {
      const { rows: [row] } = await context.pgClient.query(
        // TODO: Check if we can avoid using * in query
        // TODO: Does not work if mutation is done via nodeId or any other unique key
        `select * from ${table.namespaceName}.${table.name} where id = $1`,
        [args.input.id]
      );
      previousRecord = row;
    }

    return input;
  };

  const getcurrentRecord = async (input, args, context, resolveInfo) => {
    const relatedNodeId = input.data.__RelatedNodeId;
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
      clientMutationId: input.clientMutationId,
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

    return input;
  };

  return {
    before: [
      {
        priority: 500,
        callback: getpreviousRecord,
      },
    ],
    after: [
      {
        priority: 500,
        callback: getcurrentRecord,
      },
    ],
    error: [],
  };
};

const AddMutationTriggersPlugin = (builder) => {
  builder.hook("init", (_, build) => {
    build.addOperationHook(AddMutationTriggersOperationHook(build));

    return _;
  });
};

module.exports = AddMutationTriggersPlugin;