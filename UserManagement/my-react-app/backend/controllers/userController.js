const UserRepository = require("../repositories/userRepository");
const bcrypt = require("bcryptjs");

let activeUserRepo = new UserRepository();

exports.setUserRepository = (repo) => {
  activeUserRepo = repo;
};

exports.getUserRepository = () => activeUserRepo;

/**
 * 1. Get All Users (Admin)
 * GET /api/users
 */
exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const result = await activeUserRepo.listUsers({ search });
    return res.json(result.users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Update User Profile / Role
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, age, country, phone } = req.body;
    const userId = req.params.id;

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
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 4. Create User / Staff (Admin)
 * POST /api/users
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role = "manager", age, country, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await activeUserRepo.findByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = ["admin", "manager", "user"].includes(role) ? role : "manager";

    const newUser = await activeUserRepo.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: assignedRole,
      age: age ? Number(age) : undefined,
      country: country ? country.trim() : "",
      phone: phone ? phone.trim() : "",
      isEmailVerified: true
    });

    const sanitized = { ...newUser };
    delete sanitized.password;

    return res.status(201).json({ message: "Staff user created successfully", user: sanitized });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 5. Delete User
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const deleted = await activeUserRepo.delete(userId);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 6. Address Book - Get Addresses
 * GET /api/users/addresses/me
 */
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await activeUserRepo.getAddresses(userId);
    return res.json(addresses);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 7. Address Book - Add Address
 * POST /api/users/addresses/me
 */
exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const newAddress = await activeUserRepo.addAddress(userId, req.body);
    return res.status(201).json({ message: "Address added successfully", address: newAddress });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 8. Address Book - Update Address
 * PUT /api/users/addresses/me/:addressId
 */
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const updated = await activeUserRepo.updateAddress(userId, addressId, req.body);
    return res.json({ message: "Address updated successfully", address: updated });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
};

/**
 * 9. Address Book - Delete Address
 * DELETE /api/users/addresses/me/:addressId
 */
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const result = await activeUserRepo.deleteAddress(userId, addressId);
    return res.json({ message: "Address removed successfully", ...result });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message });
  }
};
