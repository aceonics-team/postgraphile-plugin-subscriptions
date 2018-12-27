const { makePluginByCombiningPlugins } = require("graphile-utils");
const PgSubscriptionTypesPlugin = require('./PgSubscriptionTypesPlugin');
const PgSubscriptionBasicsPlugin = require('./PgSubscriptionBasicsPlugin');
const PgMutationTriggersPlugin = require('./PgMutationTriggersPlugin');
const PgSubscriptionByEventPlugin = require('./PgSubscriptionByEventPlugin');
const PgSubscriptionByUniqueConstraintPlugin = require('./PgSubscriptionByUniqueConstraintPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  PgSubscriptionTypesPlugin,
  PgSubscriptionBasicsPlugin,
  PgMutationTriggersPlugin,
  PgSubscriptionByEventPlugin,
  PgSubscriptionByUniqueConstraintPlugin
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;