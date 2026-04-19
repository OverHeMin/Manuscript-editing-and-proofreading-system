import type { EvaluationSuite, EvaluationSuiteType } from "../src/agent-tooling.js";

const onlineExecutionRegressionSuiteTypes: EvaluationSuiteType[] = [
  "module_regression_suite",
  "scope_regression_suite",
  "rule_family_regression_suite",
];

const onlineExecutionRegressionSuite: EvaluationSuite = {
  id: "suite-1",
  name: "Editing Module Regression",
  suite_type: "module_regression_suite",
  status: "active",
  verification_check_profile_ids: [],
  module_scope: ["editing"],
  admin_only: true,
};

export {
  onlineExecutionRegressionSuite,
  onlineExecutionRegressionSuiteTypes,
};
