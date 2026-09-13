// IIFE entry for the optional networking extras (offline interception, upload and
// optimistic plugins). Load after flux.iife.js, then call FluxNet.install().
import net, { installNet } from './net.js';

installNet();

export default net;
