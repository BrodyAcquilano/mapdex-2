// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "",
  withCredentials: true,
  timeout: 120000, // 2 minutes
});

export default api;