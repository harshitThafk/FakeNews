const mongoose = require("mongoose");

const CheckSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    inputType: { type: String, enum: ["text", "url"] },
    originalInput: String,
    extractedText: String,
    status: { type: String, enum: ["processing", "completed", "error"], default: "processing" },
    mlPrediction: String,
    mlConfidence: Number,
    finalVerdict: String,
    confidenceScore: Number,
    explanation: String,
    sources: [mongoose.Schema.Types.Mixed],
    searchResults: [mongoose.Schema.Types.Mixed],
    ragChunks: [String],
    reasoningSteps: [String],
    modelUsed: String,
    processingTimeMs: Number,
    error: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Check", CheckSchema);
