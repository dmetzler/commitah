#!/usr/bin/env node

process.removeAllListeners('warning')

import { main } from "./script.js";


await main()