const { makePluginByCombiningPlugins } = require("graphile-utils");
const PgSubscriptionTypesPlugin = require('./PgSubscriptionTypesPlugin');
const PgMutationTriggersPlugin = require('./PgMutationTriggersPlugin');
const PgSubscriptionByEventPlugin = require('./PgSubscriptionByEventPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  PgSubscriptionTypesPlugin,
  PgMutationTriggersPlugin,
  PgSubscriptionByEventPlugin,
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;