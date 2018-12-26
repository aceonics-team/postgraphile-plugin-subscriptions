const { makeExtendSchemaPlugin, gql } = require("graphile-utils");

const AddMutationTypePlugin = makeExtendSchemaPlugin(build => {
  return {
    typeDefs: gql`
      enum MutationType {
        CREATED
        UPDATED
        DELETED
      }
    `,
    resolvers: {},
  };
});

module.exports = AddMutationTypePlugin;