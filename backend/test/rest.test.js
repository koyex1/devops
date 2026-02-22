const request = require("supertest");
const express = require("express");
const { issueToken } = require("../src/lib/auth");
require("dotenv").config();

test("JWT issueToken works", () => {
  process.env.JWT_SECRET = "testsecret";
  process.env.JWT_ISSUER = "iss";
  process.env.JWT_AUDIENCE = "aud";
  const t = issueToken({ sub: "u1" });
  expect(typeof t).toBe("string");
});
