const User = require("../models/User");
const UserRepository = require("../repositories/userRepository");

let activeUserRepo = new UserRepository();

const shouldUseDynamo = () => {
  if (process.env.USE_DYNAMODB === "false") return false;
  if (process.env.USE_DYNAMODB === "true" || process.env.DB_CLIENT === "dynamodb") return true;
  return true;
};

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};

exports.getUserRepository = () => activeUserRepo;

exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;

    if (shouldUseDynamo()) {
      const result = await activeUserRepo.listUsers({ search });
      return res.json(result.users);
    }

    // Fallback to legacy MongoDB
    let query = {};
    if (search) {
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitizedSearch, "i");
      query = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { role: searchRegex },
          { country: searchRegex },
          { phone: searchRegex }
        ]
      };
    }

    const users = await User.find(query).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, age, country, phone } = req.body;
    const userId = req.params.id;

    if (shouldUseDynamo()) {
      const updated = await activeUserRepo.update(userId, {
        name,
        email,
        role,
        age,
        country,
        phone
      });

      const sanitizedUser = { ...updated };
      delete sanitizedUser.password;

      return res.json({ message: "User updated successfully", user: sanitizedUser });
    }

    // Fallback to legacy MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (age !== undefined) user.age = age;
    if (country) user.country = country;
    if (phone) user.phone = phone;

    await user.save();
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    res.json({ message: "User updated successfully", user: sanitizedUser });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (shouldUseDynamo()) {
      const deleted = await activeUserRepo.delete(userId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json({ message: "User deleted successfully" });
    }

    // Fallback to legacy MongoDB
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
