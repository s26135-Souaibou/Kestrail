import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  unlink,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { upsertUserProfile } from '../lib/firestoreService';
import type { UserProfile } from '../types/domain';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    timezone: string
  ) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  linkGoogleAccount: () => Promise<void>;
  linkEmailPassword: (password: string) => Promise<void>;
  unlinkProvider: (providerId: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateOwnProfile: (updates: {
    displayName: string;
    jobTitle: string;
    phone: string;
    timezone: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function formatFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is not yet enabled in Firebase Console. Enable it under Authentication → Sign-in method, or sign in with Google.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in with your existing method and link providers from User Profile.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Sign in with your original method first, then link Google from User Profile.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign back in before changing sensitive account settings.';
    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another user.';
    case 'auth/provider-already-linked':
      return 'This authentication provider is already linked to your account.';
    default:
      return msg || 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    setProfileLoading(true);
    const uid = firebaseUser.uid;
    const path = `users/${uid}`;

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      async (snapshot) => {
        const providerIds = firebaseUser.providerData
          .map((p) => p.providerId)
          .filter(Boolean);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        if (!snapshot.exists()) {
          try {
            await upsertUserProfile(
              uid,
              {
                email: firebaseUser.email || '',
                displayName:
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'Workspace User',
                photoURL: firebaseUser.photoURL || '',
                timezone: tz,
                authProviders: providerIds.length ? providerIds : ['password'],
              },
              true
            );
          } catch (err) {
            console.error('Failed creating initial user profile:', err);
          }
        } else {
          const data = snapshot.data() as UserProfile;
          setUserProfile(data);
          setProfileLoading(false);
          // Sync newly linked auth providers if changed
          const existingSorted = [...(data.authProviders || [])].sort().join(',');
          const currentSorted = [...providerIds].sort().join(',');
          if (providerIds.length > 0 && existingSorted !== currentSorted) {
            void upsertUserProfile(
              uid,
              {
                email: data.email || firebaseUser.email || '',
                displayName: data.displayName || firebaseUser.displayName || 'User',
                photoURL: data.photoURL || firebaseUser.photoURL || '',
                jobTitle: data.jobTitle,
                phone: data.phone,
                timezone: data.timezone || tz,
                authProviders: providerIds,
                activeCompanyId: data.activeCompanyId,
              },
              false
            );
          }
        }
      },
      (error) => {
        setProfileLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser]);

  const clearAuthError = () => setAuthError(null);

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    timezone: string
  ) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await upsertUserProfile(
        cred.user.uid,
        {
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          timezone: timezone || 'UTC',
          authProviders: ['password'],
        },
        true
      );
      await sendEmailVerification(cred.user);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setFirebaseUser({ ...updated } as User);
    return updated.emailVerified;
  };

  const linkGoogleAccount = async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      const providers = result.user.providerData.map((p) => p.providerId).filter(Boolean);
      if (userProfile) {
        await upsertUserProfile(
          result.user.uid,
          {
            email: userProfile.email,
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || result.user.photoURL || '',
            jobTitle: userProfile.jobTitle,
            phone: userProfile.phone,
            timezone: userProfile.timezone,
            authProviders: providers,
            activeCompanyId: userProfile.activeCompanyId,
          },
          false
        );
      }
      setFirebaseUser({ ...result.user } as User);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const linkEmailPassword = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    setAuthError(null);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      const result = await linkWithCredential(auth.currentUser, credential);
      const providers = result.user.providerData.map((p) => p.providerId).filter(Boolean);
      if (userProfile) {
        await upsertUserProfile(
          result.user.uid,
          {
            email: userProfile.email,
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL,
            jobTitle: userProfile.jobTitle,
            phone: userProfile.phone,
            timezone: userProfile.timezone,
            authProviders: providers,
            activeCompanyId: userProfile.activeCompanyId,
          },
          false
        );
      }
      setFirebaseUser({ ...result.user } as User);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const unlinkProvider = async (providerId: string) => {
    if (!auth.currentUser) return;
    if (auth.currentUser.providerData.length <= 1) {
      throw new Error('You must keep at least one active sign-in method on your account.');
    }
    setAuthError(null);
    try {
      const updated = await unlink(auth.currentUser, providerId);
      const providers = updated.providerData.map((p) => p.providerId).filter(Boolean);
      if (userProfile) {
        await upsertUserProfile(
          updated.uid,
          {
            email: userProfile.email,
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL,
            jobTitle: userProfile.jobTitle,
            phone: userProfile.phone,
            timezone: userProfile.timezone,
            authProviders: providers,
            activeCompanyId: userProfile.activeCompanyId,
          },
          false
        );
      }
      setFirebaseUser({ ...updated } as User);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    setAuthError(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPassword);
    } catch (error) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const updateOwnProfile = async (updates: {
    displayName: string;
    jobTitle: string;
    phone: string;
    timezone: string;
  }) => {
    if (!auth.currentUser || !userProfile) return;
    await updateProfile(auth.currentUser, { displayName: updates.displayName.trim() });
    await upsertUserProfile(
      auth.currentUser.uid,
      {
        email: userProfile.email,
        displayName: updates.displayName,
        photoURL: userProfile.photoURL,
        jobTitle: updates.jobTitle,
        phone: updates.phone,
        timezone: updates.timezone,
        authProviders: userProfile.authProviders,
        activeCompanyId: userProfile.activeCompanyId,
      },
      false
    );
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authReady,
        profileLoading,
        authError,
        clearAuthError,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        resetPassword,
        resendVerificationEmail,
        reloadUser,
        linkGoogleAccount,
        linkEmailPassword,
        unlinkProvider,
        changePassword,
        updateOwnProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
