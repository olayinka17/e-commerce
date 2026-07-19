import "dotenv/config";
import request from "supertest";
import app from "../app.js";
import { redis } from "../utils/redis.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/otp.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });




describe("user endpoints", () => {
  beforeAll(async () => {
    const hashedPassword = bcrypt.hashSync("123456789", 10);
    await prisma.user.create({
      data: {
        first_name: "test",
        last_name: "testing",
        email: "test@example.com",
        password: hashedPassword,
        is_verified: true,
      },
    });
  });

  afterAll(async () => {
    // Disconnect cleanly so Jest doesn't hang
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("should return send OTP successfully", async () => {
    const user = {
      first_name: "olayinka",
      last_name: "olaniyi",
      email: "ola@example.com",
      password: "12345678",
    };
    const response = await request(app).post("/api/v1/users/signup").send(user);

    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("message", "OTP sent successfully");
    await redis.del("customer-service:OTP:ola@example.com");
  });

  it("should verify OTP", async () => {
    const mockOtp = generateOTP();
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.set(redisKey, hashedOtp, "EX", 300);

    const response = await request(app).post("/api/v1/users/verify-otp").send({
      email: "test@example.com",
      code: mockOtp,
    });

    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("token");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("user");

    const Otpcode: string = String(await redis.get(redisKey));
    console.log(Otpcode);
    expect(Otpcode).toBe("null");

  });

  it("should fail and reject an expired otp", async () => {

    const mockOtp = generateOTP();
    // const expiredTime = new Date(Date.now() - 1000);
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.multi().set(redisKey, hashedOtp).expire(redisKey, -1).exec();

    console.log("idoo")
    const response = await request(app).post("/api/v1/users/verify-otp").send({
      email: "test@example.com",
      code: mockOtp,
    });

    console.log("aoaoa")
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid or Expired OTP");
    //await redis.del("customer-service:OTP:test@example.com");
  });

  it("should fail and reject a mismatch otp", async () => {
    const mockOtp = generateOTP();
    //const expiredTime = new Date(Date.now() - 1000);
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.set(redisKey, hashedOtp, "EX", 300);

    const response = await request(app).post("/api/v1/users/verify-otp").send({
      email: "test@example.com",
      code: 123456,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid or Expired OTP");
    await redis.del("customer-service:OTP:test@example.com");
  });

  it("should resend signup otp", async () => {
    const mockOtp = generateOTP();
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);
    const redisKey = "customer-service:OTP:test@example.com";
    await redis.set(redisKey, hashedOtp, "EX", 300);
    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com",
    });
    //console.log(response)

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body.data).toHaveProperty(
      "message",
      "OTP sent successfully",
    );
    await redis.del("customer-service:OTP:test@example.com");
    await redis.del("otp:rate:test@example.com");
    await redis.del("otp:cooldown:test@example.com");
  });

  it("should resend password reset Otp", async () => {
    const mockOtp = generateOTP();
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);
    const redisKey = "customer-service:OTP:test@example.com";
    await redis.set(redisKey, hashedOtp, "EX", 300);
    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com",
      is_reset: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty(
      "message",
      "OTP sent successfully",
    );
    await redis.del("customer-service:OTP:test@example.com");
    await redis.del("otp:rate:test@example.com");
    await redis.del("otp:cooldown:test@example.com");
  });

  it("should reject if no existing Otp", async () => {
    const mockOtp = generateOTP();
    //const expiredTime = Number(Math.ceil(Date.now() - 1000) / 1000);
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.multi().set(redisKey, hashedOtp).expire(redisKey, -1).exec();

    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty(
      "message",
      "Invalid request state. please request a new OTP",
    );
    const Otpcode: string = String(await redis.get(redisKey));
    const rate = String(await redis.get("otp:rate:test@example.com"));
    const cool = String(await redis.get("otp:cooldown:test@example.com"));
    console.log(Otpcode);
    expect(Otpcode).toBe("null");
    expect(rate).toBe("null");
    expect(cool).toBe("null");
  });

  it("should rate limit if attempts is > 3 in 60 seconds", async () => {
    await redis.set(`otp:rate:test@example.com`, 3, "EX", 60);

    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com",
    });

    expect(response.statusCode).toBe(429);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Too many OTP requests");
    await redis.del("otp:rate:test@example.com");
  });

  it("should not rate limit", async () => {
    //await redis.set("otp:rate:test@example.com", 3, "EX", -1);
    await redis.multi()
  .set("otp:rate:test@example.com", 3)
  .expire("otp:rate:test@example.com", -1)
  .exec()
    await redis.set("customer-service:OTP:test@example.com", 456333, "EX", 300);
    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty(
      "message",
      "OTP sent successfully",
    );
    await redis.del("customer-service:OTP:test@example.com");
    await redis.del("otp:rate:test@example.com");
    await redis.del("otp:cooldown:test@example.com");
  });

  it("should let user cooldown", async () => {
    await redis.set("otp:cooldown:test@example.com", "1", "EX", 30);

    const response = await request(app).post("/api/v1/users/resend").send({
      email: "test@example.com"
    });

    expect(response.statusCode).toBe(429);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message");
    await redis.del("otp:rate:test@example.com");
    await redis.del("otp:cooldown:test@example.com");
  });

  it("should log existing user in", async () => {
    const response = await request(app).post("/api/v1/users/login").send({
      email: "test@example.com",
      password: "123456789",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("token");
    expect(response.body.data).toHaveProperty("user");
  });
  it(`should reject with "Invalid Credentials"`, async () => {
    const response = await request(app).post("/api/v1/users/login").send({
      email: "test@example.com",
      password: "12345678",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid Credentials");
  });

  it("should reject invalid user", async () => {
    const response = await request(app).post("/api/v1/users/login").send({
      email: "tes@example.com",
      password: "123456789",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid Credentials");
  });

  it("should reject unverified users", async () => {
    const user = {
      first_name: "olayink",
      last_name: "olani",
      email: "olani@example.com",
      password: "12345678",
    };
    await request(app).post("/api/v1/users/signup").send(user);
    const response = await request(app).post("/api/v1/users/login").send({
      email: "olani@example.com",
      password: "123456789",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty(
      "message",
      "please verify your account",
    );
  });

  it(`should send "OTP sent succesfully"`, async () => {
    const response = await request(app)
      .post("/api/v1/users/forgotpassword")
      .send({
        email: "test@example.com",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body.data).toHaveProperty(
      "message",
      "OTP sent successfully",
    );
    await redis.del("customer-service:OTP:test@example.com");
  });
  it("should reject when the user does not exist", async () => {
    const response = await request(app)
      .post("/api/v1/users/forgotpassword")
      .send({
        email: "tes@example.com",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid Credentials");
  });

  it("should reset user password successfully", async () => {
    const mockOTP = generateOTP();
    const hashedOtp = bcrypt.hashSync(String(mockOTP), 10);
    await redis.set(
      "customer-service:OTP:test@example.com",
      hashedOtp,
      "EX",
      300,
    );

    const response = await request(app)
      .patch("/api/v1/users/resetpassword")
      .send({
        password: "123456789",
        code: String(mockOTP),
        email: "test@example.com",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("token");
    expect(response.body.data).toHaveProperty("user");
  });

  it("should fail and reject an expired OTP", async () => {
    const mockOtp = generateOTP();
    // const expiredTime = new Date(Date.now() - 1000);
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.multi().set(redisKey, hashedOtp).expire(redisKey, -1).exec();

    const response = await request(app).post("/api/v1/users/verify-otp").send({
      email: "test@example.com",
      code: mockOtp,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid or Expired OTP");
    //await redis.del("customer-service:OTP:test@example.com");
  });

  it("should reject when there is an OTP mismatch", async () => {
    const mockOtp = generateOTP();
    //const expiredTime = new Date(Date.now() - 1000);
    const hashedOtp = bcrypt.hashSync(mockOtp.toString(), 10);

    const redisKey: string = `customer-service:OTP:test@example.com`;

    await redis.set(redisKey, hashedOtp, "EX", 300);

    const response = await request(app).post("/api/v1/users/verify-otp").send({
      email: "test@example.com",
      code: 123456,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("status", "fail");
    expect(response.body).toHaveProperty("message", "Invalid or Expired OTP");
    await redis.del("customer-service:OTP:test@example.com");
  });
});
