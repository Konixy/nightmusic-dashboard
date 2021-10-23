import mongoose from "mongoose"

export default mongoose.Schema({
  _id: {
      type: String,
      required: true
  },
  prefixDb: {
      type: String,
      required: true
  },
  volDb: {
      type: Number,
      required: true
  },
})