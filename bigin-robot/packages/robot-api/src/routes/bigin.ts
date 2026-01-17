/**
 * Bigin Robot API Routes
 */

import { Router, Request, Response } from 'express';
import { RobotBase } from '@modelo-ia/robot-base';
import { BiginAdapter } from '@modelo-ia/adapter-bigin';
import type { CreateOrdenInput, BiginConfig } from '@modelo-ia/adapter-bigin';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import type { ApiResponse } from '../types/api';
import path from 'path';

const router = Router();

// Shared robot instance (reuses session)
let robotInstance: RobotBase | null = null;
let adapterInstance: BiginAdapter | null = null;

/**
 * Check if browser is still active
 */
async function isBrowserActive(): Promise<boolean> {
  if (!robotInstance) return false;

  try {
    const page = robotInstance.engine.getPage();
    // Try to get the URL as a simple test that page is responsive
    await page.url();
    return true;
  } catch (error) {
    console.log('⚠️  Browser check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Reinitialize robot and adapter from scratch
 */
async function reinitialize(): Promise<void> {
  console.log('🔄 Reinitializing robot and adapter...');

  // Cleanup old instances
  if (adapterInstance || robotInstance) {
    try {
      await adapterInstance?.close();
    } catch (e) {
      console.log('⚠️  Error closing adapter:', e);
    }
    adapterInstance = null;
    robotInstance = null;
  }

  // Force reinit
  await getAdapter();
}

/**
 * Initialize robot and adapter
 */
async function getAdapter(): Promise<BiginAdapter> {
  // If instances exist, verify browser is still active
  if (adapterInstance && robotInstance) {
    const browserActive = await isBrowserActive();
    if (browserActive) {
      console.log('✅ Using existing robot instance (browser active)');
      return adapterInstance;
    } else {
      console.log('❌ Browser is closed, reinitializing...');
      adapterInstance = null;
      robotInstance = null;
    }
  }

  // Initialize robot
  console.log('🤖 Initializing new robot instance...');
  robotInstance = new RobotBase({
    headless: true,
    screenshotsEnabled: true,
    storagePath: process.env.STORAGE_PATH || path.join(__dirname, '../../../storage')
  });

  await robotInstance.init();
  console.log('✅ Robot initialized');

  // Initialize Bigin adapter
  const config: BiginConfig = {
    url: process.env.BIGIN_URL || 'https://accounts.zoho.com/signin',
    email: process.env.BIGIN_EMAIL!,
    password: process.env.BIGIN_PASSWORD!,
    passphrase: process.env.BIGIN_PASSPHRASE
  };

  if (!config.email || !config.password) {
    throw new ApiError(500, 'Missing BIGIN_EMAIL or BIGIN_PASSWORD in environment');
  }

  adapterInstance = new BiginAdapter(robotInstance, config);
  console.log('✅ Adapter initialized');

  // Login once
  console.log('🔐 Logging in to Bigin...');
  await adapterInstance.login();
  console.log('✅ Login successful');

  return adapterInstance;
}

/**
 * POST /bigin/create-order
 * Create a new order in Bigin
 */
router.post('/create-order', asyncHandler(async (req: Request, res: Response) => {
  const orderData: CreateOrdenInput = req.body;

  // Validate required fields
  if (!orderData.ordenName) {
    throw new ApiError(400, 'ordenName is required');
  }

  console.log('📝 Creating order:', orderData.ordenName);

  // Ensure we have a valid adapter (this checks browser and reinitializes if needed)
  const adapter = await getAdapter();

  // Try creating order with existing session
  // If session expired or browser closed, reinitialize and retry
  let retryCount = 0;
  const maxRetries = 2;
  let orderResult: { orderId: string; orderUrl: string } | null = null;

  while (retryCount < maxRetries) {
    try {
      orderResult = await adapter.createOrder(orderData);
      break; // Success, exit loop
    } catch (error: any) {
      retryCount++;
      const errorMsg = error.message || String(error);

      console.log(`⚠️  Attempt ${retryCount}/${maxRetries} failed:`, errorMsg);

      // Check if error is due to closed browser/page
      if (errorMsg.includes('Target page, context or browser has been closed') ||
          errorMsg.includes('page.screenshot') ||
          errorMsg.includes('browser') ||
          errorMsg.includes('page is closed')) {

        if (retryCount < maxRetries) {
          console.log('🔄 Browser closed detected, reinitializing and retrying...');
          await reinitialize();
          continue; // Retry with new instance
        }
      }

      // Check if error is session-related
      if (errorMsg.includes('login') ||
          errorMsg.includes('session') ||
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('not logged in')) {

        if (retryCount < maxRetries) {
          console.log('🔐 Session expired, re-authenticating and retrying...');
          await adapter.login();
          continue; // Retry after login
        }
      }

      // If we've exhausted retries or it's a different error, throw
      if (retryCount >= maxRetries) {
        console.log(`❌ Failed after ${maxRetries} attempts`);
        throw new ApiError(500, `Failed to create order after ${maxRetries} attempts: ${errorMsg}`);
      }

      // Unknown error, throw immediately
      throw error;
    }
  }

  const response: ApiResponse = {
    success: true,
    message: 'Order created successfully',
    data: {
      ordenName: orderData.ordenName,
      orderId: orderResult?.orderId || 'unknown',
      orderUrl: orderResult?.orderUrl || ''
    }
  };

  console.log('✅ Order created:', orderData.ordenName);
  console.log('📎 Order ID:', orderResult?.orderId);
  console.log('🔗 Order URL:', orderResult?.orderUrl);
  res.json(response);
}));

/**
 * POST /bigin/find-lead
 * Find a lead by phone, email, or name
 */
router.post('/find-lead', asyncHandler(async (req: Request, res: Response) => {
  const { phone, email, name } = req.body;

  if (!phone && !email && !name) {
    throw new ApiError(400, 'At least one of phone, email, or name is required');
  }

  console.log('🔍 Finding lead:', { phone, email, name });

  const adapter = await getAdapter();
  const lead = await adapter.findLead({ phone, email, name });

  const response: ApiResponse = {
    success: true,
    data: lead,
    message: lead ? 'Lead found' : 'Lead not found'
  };

  res.json(response);
}));

/**
 * POST /bigin/create-lead
 * Create a new lead
 */
router.post('/create-lead', asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, phone, email, company, source } = req.body;

  if (!firstName || !lastName) {
    throw new ApiError(400, 'firstName and lastName are required');
  }

  console.log('➕ Creating lead:', firstName, lastName);

  const adapter = await getAdapter();
  const lead = await adapter.createLead({
    firstName,
    lastName,
    phone,
    email,
    company,
    source
  });

  const response: ApiResponse = {
    success: true,
    data: lead,
    message: 'Lead created successfully'
  };

  res.json(response);
}));

/**
 * POST /bigin/add-note
 * Add a note to a lead
 */
router.post('/add-note', asyncHandler(async (req: Request, res: Response) => {
  const { leadId, note } = req.body;

  if (!leadId || !note) {
    throw new ApiError(400, 'leadId and note are required');
  }

  console.log('📝 Adding note to lead:', leadId);

  const adapter = await getAdapter();
  await adapter.addNote({ leadId, note });

  const response: ApiResponse = {
    success: true,
    message: 'Note added successfully'
  };

  res.json(response);
}));

/**
 * GET /bigin/health
 * Check if Bigin adapter is working
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const isInitialized = adapterInstance !== null;

  const response: ApiResponse = {
    success: true,
    data: {
      initialized: isInitialized,
      status: isInitialized ? 'ready' : 'not initialized'
    }
  };

  res.json(response);
}));

/**
 * POST /bigin/logout
 * Logout and cleanup
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  if (adapterInstance) {
    await adapterInstance.close();
    adapterInstance = null;
    robotInstance = null;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Logged out successfully'
  };

  res.json(response);
}));

export default router;
