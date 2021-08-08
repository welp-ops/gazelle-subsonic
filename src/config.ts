import { AllConfig } from './types'
import { readFileSync } from 'fs'

let config: AllConfig;

// synchronously read config from disk, or return it if already read.
export default function getConfig(): AllConfig {
    config = config || eval(readFileSync('./config.js', { encoding: 'utf-8' })) as AllConfig;
    return config;
}
