/**
 * Единственное место импорта expo-secure-store. Функции вызываются только на native:
 * на web createTokenStorage() не подключает этот адаптер к хранилищу сессии.
 */
import * as SecureStore from 'expo-secure-store';

import type { SecureStorageAdapter } from './tokenStorage';

export function createNativeSecureStore(): SecureStorageAdapter {
  return {
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  };
}
