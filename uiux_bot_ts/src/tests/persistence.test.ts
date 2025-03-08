/**
 * Tests for the persistence module
 */

import fs from 'fs';
import path from 'path';
import * as persistence from '../app/utils/persistence';
import { settings } from '../app/config/settings';

// Mock the settings
jest.mock('../app/config/settings', () => ({
  settings: {
    DATA_DIR: './test-data',
    ADMIN_USER_IDS: [123456789],
    AUTO_ADMIN_SUBSCRIBERS: false,
  },
  SUBSCRIBERS_FILE: './test-data/subscribers.json',
  HEALTH_FILE: './test-data/health.json',
}));

// Mock the logger
jest.mock('../app/utils/logger', () => ({
  getChildLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Persistence Module', () => {
  // Setup and teardown
  beforeEach(() => {
    // Create test data directory
    if (!fs.existsSync('./test-data')) {
      fs.mkdirSync('./test-data', { recursive: true });
    }
    
    // Clear any existing test data
    if (fs.existsSync('./test-data/subscribers.json')) {
      fs.unlinkSync('./test-data/subscribers.json');
    }
    
    if (fs.existsSync('./test-data/health.json')) {
      fs.unlinkSync('./test-data/health.json');
    }
  });
  
  afterEach(() => {
    // Clean up test data
    if (fs.existsSync('./test-data/subscribers.json')) {
      fs.unlinkSync('./test-data/subscribers.json');
    }
    
    if (fs.existsSync('./test-data/health.json')) {
      fs.unlinkSync('./test-data/health.json');
    }
    
    if (fs.existsSync('./test-data')) {
      fs.rmdirSync('./test-data');
    }
  });
  
  // Tests
  test('initialize should create data directory and load subscribers', () => {
    persistence.initialize();
    
    expect(fs.existsSync('./test-data')).toBe(true);
  });
  
  test('addSubscriber should add a new subscriber', () => {
    persistence.initialize();
    
    const subscriber = persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    
    expect(subscriber).toBeDefined();
    expect(subscriber.id).toBe(123);
    expect(subscriber.firstName).toBe('John');
    expect(subscriber.lastName).toBe('Doe');
    expect(subscriber.username).toBe('johndoe');
    expect(subscriber.lessonCount).toBe(0);
    expect(subscriber.quizCount).toBe(0);
    expect(subscriber.isAdmin).toBe(false);
  });
  
  test('addSubscriber should set isAdmin to true for admin user IDs', () => {
    persistence.initialize();
    
    const subscriber = persistence.addSubscriber(123456789, 'Admin', 'User', 'admin');
    
    expect(subscriber).toBeDefined();
    expect(subscriber.id).toBe(123456789);
    expect(subscriber.isAdmin).toBe(true);
  });
  
  test('getSubscriber should return a subscriber by ID', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    const subscriber = persistence.getSubscriber(123);
    
    expect(subscriber).toBeDefined();
    expect(subscriber?.id).toBe(123);
    expect(subscriber?.firstName).toBe('John');
  });
  
  test('getSubscriber should return undefined for non-existent subscriber', () => {
    persistence.initialize();
    
    const subscriber = persistence.getSubscriber(999);
    
    expect(subscriber).toBeUndefined();
  });
  
  test('removeSubscriber should remove a subscriber', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    const result = persistence.removeSubscriber(123);
    
    expect(result).toBe(true);
    expect(persistence.getSubscriber(123)).toBeUndefined();
  });
  
  test('removeSubscriber should return false for non-existent subscriber', () => {
    persistence.initialize();
    
    const result = persistence.removeSubscriber(999);
    
    expect(result).toBe(false);
  });
  
  test('updateSubscriberActivity should update last activity', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    
    // Wait a bit to ensure the timestamp changes
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    return wait(10).then(() => {
      const beforeUpdate = persistence.getSubscriber(123)?.lastActivity;
      
      persistence.updateSubscriberActivity(123);
      
      const afterUpdate = persistence.getSubscriber(123)?.lastActivity;
      
      expect(beforeUpdate).not.toBe(afterUpdate);
    });
  });
  
  test('incrementLessonCount should increment lesson count', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    
    persistence.incrementLessonCount(123);
    
    const subscriber = persistence.getSubscriber(123);
    
    expect(subscriber?.lessonCount).toBe(1);
  });
  
  test('incrementQuizCount should increment quiz count', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    
    persistence.incrementQuizCount(123);
    
    const subscriber = persistence.getSubscriber(123);
    
    expect(subscriber?.quizCount).toBe(1);
  });
  
  test('getAllSubscribers should return all subscribers', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    persistence.addSubscriber(456, 'Jane', 'Doe', 'janedoe');
    
    const subscribers = persistence.getAllSubscribers();
    
    expect(subscribers.length).toBe(2);
    expect(subscribers[0].id).toBe(123);
    expect(subscribers[1].id).toBe(456);
  });
  
  test('getAdminSubscribers should return only admin subscribers', () => {
    persistence.initialize();
    
    persistence.addSubscriber(123, 'John', 'Doe', 'johndoe');
    persistence.addSubscriber(123456789, 'Admin', 'User', 'admin');
    
    const admins = persistence.getAdminSubscribers();
    
    expect(admins.length).toBe(1);
    expect(admins[0].id).toBe(123456789);
  });
  
  test('updateHealthStatus should update health status', () => {
    persistence.initialize();
    
    persistence.updateHealthStatus();
    
    const health = persistence.getHealthStatus();
    
    expect(health).toBeDefined();
    expect(health.isHealthy).toBe(true);
  });
  
  test('updateHealthStatus should set isHealthy to false on error', () => {
    persistence.initialize();
    
    persistence.updateHealthStatus(new Error('Test error'));
    
    const health = persistence.getHealthStatus();
    
    expect(health).toBeDefined();
    expect(health.isHealthy).toBe(false);
    expect(health.lastError).toBe('Test error');
  });
}); 