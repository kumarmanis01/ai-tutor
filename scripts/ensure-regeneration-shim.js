#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = process.argv[2] || process.cwd()
const targetDir = path.join(root, 'dist', 'src', 'regeneration')
const shimPath = path.join(targetDir, 'generatorAdapter')
const real = './generatorAdapter.js'

try{
  fs.mkdirSync(targetDir, { recursive: true })
  if (!fs.existsSync(shimPath)){
    fs.writeFileSync(shimPath, `export { default } from '${real}';\n`, 'utf8')
    console.log('wrote shim', shimPath)
  } else {
    console.log('shim already exists:', shimPath)
  }
}catch(e){
  console.error('failed to write shim', e && e.message)
  process.exit(1)
}
