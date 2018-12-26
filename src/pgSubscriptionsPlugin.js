const { makePluginByCombiningPlugins } = require("graphile-utils");
const AddMutationTypePlugin = require('./addMutationTypePlugin');
const AddMutationTriggersPlugin = require('./addMutationTriggersPlugin');
const AddSubscriptionsPlugin = require('./addSubscriptionsPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  AddMutationTypePlugin,
  AddMutationTriggersPlugin,
  AddSubscriptionsPlugin,
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;