/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/modules/sessions/earlyLeaveHalfDay.ts",
    "src/modules/attendance/aggregateLateness.ts",
    "src/modules/attendance/attendanceFlags.ts",
    "src/modules/attendance/dateRangeValidation.ts",
    "src/modules/attendance/absenceAggregation.ts",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};
