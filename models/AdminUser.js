// models/AdminUser.js
import mongoose from "mongoose";

const AdminUserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("AdminUser", AdminUserSchema);
