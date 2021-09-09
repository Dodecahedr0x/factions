import { expect } from "chai";

export default async (expression: Promise<any>) => {
  let failed = false;
  try {
    await expression;
  } catch {
    failed = true;
  }
  expect(failed === true)
};
