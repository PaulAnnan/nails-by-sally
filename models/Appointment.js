// models/Appointment.js
import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    serviceId: { type: String, required: true },
    serviceName: String,
    durationMin: { type: Number, required: true },

    // salon-local calendar day (YYYY-MM-DD)
    date: { type: String, required: true },

    // UTC instants computed from date + time in salon TZ
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    price: Number,
    notes: String,
    status: {
      type: String,
      enum: ["pending", "booked", "completed", "canceled"],
      default: "pending", // <— NEW default
    },
  },
  { timestamps: true }
);

AppointmentSchema.index({ date: 1, startAt: 1 });

// Keep default collection (“appointments”). If you must force "Appointment":
// export default mongoose.model("Appointment", AppointmentSchema, "Appointment");
export default mongoose.model("Appointment", AppointmentSchema);
