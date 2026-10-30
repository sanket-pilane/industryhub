pm.test("health response is successful", () => {
  pm.response.to.have.status(200);
  const value = pm.response.json();
  pm.expect(value.success).to.equal(true);
  pm.expect(value.error).to.equal(null);
  pm.expect(value.meta.requestId).to.be.a("string");
});
pm.test("service runs local mock mode", () => {
  const value = pm.response.json();
  pm.expect(value.data.service).to.equal("INDUSTRIHUB");
  pm.expect(value.data.mode).to.equal("mock");
});
