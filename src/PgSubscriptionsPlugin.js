const { makePluginByCombiningPlugins } = require("graphile-utils");
const PgSubscriptionTypesPlugin = require('./PgSubscriptionTypesPlugin');
const PgMutationTriggersPlugin = require('./PgMutationTriggersPlugin');
const PgOnEventSubscriptionsPlugin = require('./PgOnEventSubscriptionsPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  PgSubscriptionTypesPlugin,
  PgMutationTriggersPlugin,
  PgOnEventSubscriptionsPlugin,
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;