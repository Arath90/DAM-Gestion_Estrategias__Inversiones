//src/helpers/variables.js
// What type of variable is it?
function whatTypeVarIs(variable) {
  if (Array.isArray(variable)) return 'isArray';
  if (typeof variable === 'object' && variable !== null) return 'isObject';
  return null;
}
module.exports = { whatTypeVarIs };
