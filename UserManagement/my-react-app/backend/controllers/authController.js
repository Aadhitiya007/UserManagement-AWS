const User = require("../models/User");
const UserRepository = require("../repositories/userRepository");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let activeUserRepo = new UserRepository();

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is missing.");
  }
  return process.env.JWT_SECRET;
};

const shouldUseDynamo = () => {
  if (process.env.USE_DYNAMODB === "false") return false;
  if (process.env.USE_DYNAMODB === "true" || process.env.DB_CLIENT === "dynamodb") return true;
  return true;
};

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};

exports.getUserRepository = () => activeUserRepo;

exports.register = async (req, res) => {
  try {
    const { name, email, password, age, country, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    if (shouldUseDynamo()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      try {
        const user = await activeUserRepo.create({
          name,
          email,
          password: hashedPassword,
          role: "user",
          age,
          country,
          phone
        });

        const token = jwt.sign(
          { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
          getJwtSecret(),
          { expiresIn: "7d" }
        );

        return res.status(201).json({
          message: "User registered successfully",
          token,
          user: {
            id: user.id || user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        });
      } catch (err) {
        if (err.statusCode === 400 || (err.message && err.message.includes("already registered"))) {
          return res.status(400).json({ message: "Email is already registered" });
        }
        throw err;
      }
    }

    // Fallback to legacy MongoDB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Security fix: Force role to "user" to prevent privilege escalation
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      age,
      country,
      phone
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (shouldUseDynamo()) {
      const user = await activeUserRepo.findByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    }

    // Fallback to legacy MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
