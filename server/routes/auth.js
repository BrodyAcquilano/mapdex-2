import express from "express";
import { tinyJson } from "../middleware/bodyLimits.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { getDB } from "../db.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email/email.js";
import {
  hasExactKeys,
  hasNoKeys,
  validateAuthToken,
  validateEmail,
  validatePassword,
  validateUserName,
} from "../../shared/auth/auth.js";

const router = express.Router();

/* ─────────────────────────────
   Helper: Convert expires string (e.g. "7d", "12h") to ms
───────────────────────────── */
function parseExpiryToMs(exp) {
  if (!exp) return 7 * 24 * 60 * 60 * 1000;

  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 1);
}

/* ─────────────────────────────
   GET - Current Authenticated User
───────────────────────────── */
router.get("/me", optionalAuth, async (req, res) => {
  if (!req.userId) {
    return res.status(200).json({
      message: "No active session.",
      data: null,
    });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const { ObjectId } = await import("mongodb");

    const user = await users.findOne(
      { _id: new ObjectId(req.userId) },
      {
        projection: {
          _id: 1,
          accountStatus: 1,
          isDeleted: 1,
        },
      },
    );

    if (!user || user.isDeleted || user.accountStatus === "suspended") {
      return res.status(200).json({
        message: "No active session.",
        data: null,
      });
    }

    return res.status(200).json({
      message: "Authenticated user retrieved.",
      data: {
        authenticated: true,
      },
    });
  } catch (err) {
    console.error("Fetch /me failed:", err);
    return res.status(500).json({
      error: "Failed to fetch user.",
    });
  }
});

/* ─────────────────────────────
   POST - Login User
───────────────────────────── */
router.post("/login", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["email", "password"])) {
    return res.status(400).json({
      error: "Invalid login payload.",
    });
  }

  const { email, password } = req.body;

  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const passwordError = validatePassword(password, normalizedEmail);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
      });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const cookieMaxAge = parseExpiryToMs(expiresIn);

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        userName: user.userName,
      },
      process.env.JWT_SECRET,
      { expiresIn },
    );

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: cookieMaxAge,
    });

    return res.json({
      message: "Login successful.",
      data: { ok: true },
    });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(500).json({
      error: "Failed to login.",
    });
  }
});


/* ─────────────────────────────
   POST - Logout User
───────────────────────────── */
router.post("/logout", tinyJson, (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      error: "Invalid logout payload.",
    });
  }

  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
  });

  return res.json({
    message: "Logged out successfully.",
  });
});

/* ─────────────────────────────
   POST - Add User (Register)
───────────────────────────── */
router.post("/register", tinyJson, async (req, res) => {
 return res.status(403).json({
  error:
    "Mapdex is not currently accepting new users while the app is still in development.",
});

  if (!hasExactKeys(req.body, ["email", "password", "userName"])) {
    return res.status(400).json({
      error: "Invalid registration payload.",
    });
  }

  const { email, password, userName } = req.body;

  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const userNameError = validateUserName(userName);
  if (userNameError) {
    return res.status(400).json({ error: userNameError });
  }

  const normalizedUserName = userName.trim();

  const passwordError = validatePassword(password, normalizedEmail);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const db = getDB();
    const users = db.collection("users");

    const existingUserByEmail = await users.findOne({ email: normalizedEmail });

    if (existingUserByEmail) {
      if (existingUserByEmail.emailVerified) {
        return res.status(400).json({
          error: "Email already exists.",
        });
      }

     const userNameOwner = await users.findOne({
  _id: { $ne: existingUserByEmail._id },
  $expr: {
    $eq: [
      { $toLower: "$userName" },
      normalizedUserName.toLowerCase(),
    ],
  },
});

      if (userNameOwner) {
        return res.status(400).json({
          error: "Username is already taken.",
        });
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 60 * 60 * 1000);

      await users.updateOne(
        { _id: existingUserByEmail._id },
        {
          $set: {
            userName: normalizedUserName,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
            passwordHash: await bcrypt.hash(password, 10),
            updatedAt: new Date(),
          },
        },
      );

      await sendVerificationEmail({
        to: normalizedEmail,
        token: verificationToken,
      });

      return res.status(200).json({
        message: "Account exists but is unverified. New verification email sent.",
        data: { ok: true },
      });
    }

  const existingUserByUserName = await users.findOne({
  $expr: {
    $eq: [
      { $toLower: "$userName" },
      normalizedUserName.toLowerCase(),
    ],
  },
});

    if (existingUserByUserName) {
      return res.status(400).json({
        error: "Username is already taken.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 60 * 60 * 1000);

    await users.insertOne({
      email: normalizedEmail,
      userName: normalizedUserName,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      isDeleted: false,
      deletedAt: null,
      accountStatus: "active",
      oauthProviders: [],
      subscriptionTier: "free",
      voicePlan: "free",
      userColorTheme: "green",
      followers: [],
      following: [],
      blockedUsers: [],
      favouriteProjects: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await sendVerificationEmail({
      to: normalizedEmail,
      token: verificationToken,
    });

    return res.status(201).json({
      message: "Registration successful. Please check your email.",
      data: { ok: true },
    });
  } catch (err) {
    console.error("User insert failed:", err);
    return res.status(500).json({
      error: "Failed to register user.",
    });
  }
});

/* ─────────────────────────────
   GET - Verify Email
───────────────────────────── */
router.get("/verify-email", async (req, res) => {
  if (!hasExactKeys(req.query, ["token"])) {
    return res.status(400).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }

  const { token } = req.query;

  const tokenError = validateAuthToken(token);
  if (tokenError) {
    return res.status(400).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }

  const normalizedToken = token.trim();

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({
      emailVerificationToken: normalizedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Verification link expired. Please register again to receive a new email.",
      });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationExpires: "",
        },
      },
    );

    return res.json({
      success: true,
      message: "Email verified successfully. You may now sign in.",
    });
  } catch (err) {
    console.error("Verification failed:", err);

    return res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
});

/* ─────────────────────────────
   POST - Request Password Reset
───────────────────────────── */
router.post("/request-password-reset", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["email"])) {
    return res.status(400).json({
      error: "Invalid password reset request payload.",
    });
  }

  const { email } = req.body;

  const emailError = validateEmail(email);
  if (emailError) {
    return res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({ email: normalizedEmail });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
            updatedAt: new Date(),
          },
        },
      );

      await sendPasswordResetEmail({
        to: normalizedEmail,
        token: resetToken,
      });
    }

    return res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Password reset request failed:", err);

    return res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  }
});

/* ─────────────────────────────
   POST - Verify Password Reset Token
───────────────────────────── */
router.post("/verify-password-reset", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["token"])) {
    return res.status(400).json({
      success: false,
      message: "Invalid reset link.",
    });
  }

  const { token } = req.body;

  const tokenError = validateAuthToken(token);
  if (tokenError) {
    return res.status(400).json({
      success: false,
      message: "Invalid reset link.",
    });
  }

  const normalizedToken = token.trim();

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({
      passwordResetToken: normalizedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    return res.json({
      success: true,
      message: "Reset link valid.",
    });
  } catch (err) {
    console.error("Verify reset token failed:", err);
    return res.status(500).json({
      success: false,
      message: "Invalid or expired reset link.",
    });
  }
});

/* ─────────────────────────────
   POST - Reset Password
───────────────────────────── */
router.post("/reset-password", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["token", "password"])) {
    return res.status(400).json({
      success: false,
      message: "Invalid password reset payload.",
    });
  }

  const { token, password } = req.body;

  const tokenError = validateAuthToken(token);
  if (tokenError) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset link.",
    });
  }

  const normalizedToken = token.trim();

  if (typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Password must be text.",
    });
  }

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({
      passwordResetToken: normalizedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    const passwordError = validatePassword(password, user.email);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
        $unset: {
          passwordResetToken: "",
          passwordResetExpires: "",
        },
      },
    );

    return res.json({
      success: true,
      message: "Password reset successful. You may now sign in.",
    });
  } catch (err) {
    console.error("Reset password failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
  }
});

export default router;