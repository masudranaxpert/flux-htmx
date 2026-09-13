// IIFE entry for the optional networking extras (offline interception, upload and
// optimistic plugins). Load after flux.iife.js — plugins install automatically on
// load. `FluxNet.install()` re-installs after `Flux.dispose()`.
import net, { installNet } from './net.js';

installNet();

export default net;
