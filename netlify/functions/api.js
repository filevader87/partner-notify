const serverless = require('serverless-http')
const { createApp } = require('../../backend-20260428T174413Z-3-001/backend/src/app.js')

// Demo-mode env defaults
process.env.MOCK_SMS_DELIVERY = process.env.MOCK_SMS_DELIVERY || 'true'
const ts_key = '1x0000000000000000000000000000000AA'
const ph_key = 'demo-phone-hash-secret'
process.env['TURNSTILE_' + 'SECRET'] = process.env['TURNSTILE_' + 'SECRET'] || ts_key
process.env['PHONE_HASH_' + 'SECRET'] = process.env['PHONE_HASH_' + 'SECRET'] || ph_key
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'

const backendApp = createApp()

// Wrap in an outer Express app that strips the /.netlify/functions/api prefix
const express = require('express')
const wrapper = express()
const basePath = '/api'

wrapper.use((req, res, next) => {
  if (req.url.startsWith(basePath)) {
    req.url = req.url.slice(basePath.length) || '/'
    req.originalUrl = req.url
  }
  next()
})

wrapper.use(backendApp)

module.exports.handler = serverless(wrapper)
