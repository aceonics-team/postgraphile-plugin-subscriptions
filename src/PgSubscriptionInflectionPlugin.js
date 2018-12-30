const PgSubscriptionInflectionPlugin = (builder) => {
  builder.hook("inflection", (inflection, build) => {
    return build.extend(
      inflection,
      {
        allSubscriptionRows(table) {
          return this.camelCase(
            `on-all-${this.pluralize(this._singularizedTableName(table))}-mutation`
          );
        },
        allSubscriptionRowsSimple(table) {
          return this.camelCase(
            `on-all-${this.pluralize(this._singularizedTableName(table))}-list-mutation`
          );
        },
        subscriptionRow(table) {
          return this.camelCase(
            `on-${this._singularizedTableName(table)}-mutation`
          );
        },
        subscriptionRowByUniqueKeys(
          detailedKeys,
          table,
          constraint
        ) {
          if (constraint.tags.fieldName) {
            return constraint.tags.fieldName;
          }
          return this.camelCase(
            `on-${this._singularizedTableName(table)}-mutation-by-${detailedKeys
              .map(key => this.column(key))
              .join("-and-")}`
          );
        },
        subscribeAllRowsInputType(table) {
          return this.upperCamelCase(
            `subscribe-all-${this.pluralize(this._singularizedTableName(table))}-input`
          );
        },
        subscribeRowInputType(table) {
          return this.upperCamelCase(
            `subscribe-${this._singularizedTableName(table)}-input`
          );
        },
        subscribeRowByUniqueKeysInputType(detailedKeys,
          table,
          constraint
        ) {
          if (constraint.tags.fieldName) {
            return constraint.tags.fieldName;
          }
          return this.camelCase(
            `subscribe-${this._singularizedTableName(table)}-by-${detailedKeys
              .map(key => this.column(key))
              .join("-and-")}-input`
          );
        },
        subscribePayloadType(table) {
          return this.upperCamelCase(
            `subscribe-${this._singularizedTableName(table)}-payload`
          );
        },
      }
    );
  });
};

module.exports = PgSubscriptionInflectionPlugin;