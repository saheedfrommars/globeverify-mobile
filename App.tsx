import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { WalletSettingsProvider } from './src/context/WalletSettingsContext';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { OtpScreen } from './src/screens/auth/OtpScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/auth/ResetPasswordScreen';
import { DashboardScreen } from './src/screens/dashboard/DashboardScreen';
import { BuyNumberScreen } from './src/screens/numbers/BuyNumberScreen';
import { MyNumbersScreen } from './src/screens/numbers/MyNumbersScreen';
import { RentalsScreen } from './src/screens/rentals/RentalsScreen';
import { WalletScreen } from './src/screens/wallet/WalletScreen';
import { MoreScreen } from './src/screens/more/MoreScreen';
import { CustomizationScreen } from './src/screens/customization/CustomizationScreen';
import { AffiliateScreen } from './src/screens/affiliate/AffiliateScreen';
import { DeveloperScreen } from './src/screens/developer/DeveloperScreen';
import { SupportScreen } from './src/screens/support/SupportScreen';
import { VeraSupportChat } from './src/components/ui/VeraSupportChat';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './src/components/ui/Button';
import { Logo } from './src/components/ui/Logo';
import { useTheme } from './src/theme';

type AuthStep =
  | 'onboarding'
  | 'login'
  | 'register'
  | 'otp'
  | 'forgot'
  | 'reset'
  | 'dashboard';

type AuthenticatedScreen =
  | 'dashboard'
  | 'buy-number'
  | 'numbers'
  | 'wallet'
  | 'rentals'
  | 'more'
  | 'customization'
  | 'affiliate'
  | 'developer'
  | 'support';

interface OtpState {
  email: string;
  type: 'login' | 'register' | 'forgot';
  twoFactorMethod?: string;
}

function MainNavigator() {
  const { isAuthenticated, user } = useAuth();

  const [currentStep, setCurrentStep] = useState<AuthStep>('onboarding');
  const [activeAppScreen, setActiveAppScreen] = useState<AuthenticatedScreen>('dashboard');
  const [otpParams, setOtpParams] = useState<OtpState>({ email: '', type: 'register' });
  const [resetEmail, setResetEmail] = useState('');

  // If already authenticated, show the rich app screens wrapped with global AppSettings navigation
  if (isAuthenticated && user) {
    let screenContent: React.ReactNode = null;

    if (activeAppScreen === 'buy-number') {
      screenContent = (
        <BuyNumberScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else if (activeAppScreen === 'numbers') {
      screenContent = (
        <MyNumbersScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else if (activeAppScreen === 'rentals') {
      screenContent = (
        <RentalsScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else if (activeAppScreen === 'wallet') {
      screenContent = (
        <WalletScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToMore={() => setActiveAppScreen('more')}
        />
      );
    } else if (activeAppScreen === 'more') {
      screenContent = (
        <MoreScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
          onNavigateToCustomization={() => setActiveAppScreen('customization')}
        />
      );
    } else if (activeAppScreen === 'customization') {
      screenContent = (
        <CustomizationScreen
          onBack={() => setActiveAppScreen('more')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
          onNavigateToSettings={() => setActiveAppScreen('more')}
        />
      );
    } else if (activeAppScreen === 'affiliate') {
      screenContent = (
        <AffiliateScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else if (activeAppScreen === 'developer') {
      screenContent = (
        <DeveloperScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else if (activeAppScreen === 'support') {
      screenContent = (
        <SupportScreen
          onBack={() => setActiveAppScreen('dashboard')}
          onNavigateToHome={() => setActiveAppScreen('dashboard')}
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
        />
      );
    } else {
      screenContent = (
        <DashboardScreen
          onNavigateToBuy={() => setActiveAppScreen('buy-number')}
          onNavigateToNumbers={() => setActiveAppScreen('numbers')}
          onNavigateToWallet={() => setActiveAppScreen('wallet')}
          onNavigateToRentals={() => setActiveAppScreen('rentals')}
          onNavigateToMore={() => setActiveAppScreen('more')}
        />
      );
    }

    return (
      <WalletSettingsProvider
        activeScreen={activeAppScreen}
        onNavigateScreen={(scr) => setActiveAppScreen(scr)}
      >
        <View style={{ flex: 1 }}>
          {screenContent}
          <VeraSupportChat />
        </View>
      </WalletSettingsProvider>
    );
  }

  // Auth routing
  switch (currentStep) {
    case 'onboarding':
      return (
        <OnboardingScreen
          onComplete={(action) => {
            if (action === 'register') {
              setCurrentStep('register');
            } else {
              setCurrentStep('login');
            }
          }}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onNavigateToRegister={() => setCurrentStep('register')}
          onNavigateToForgot={() => setCurrentStep('forgot')}
          onNavigateToOtp={({ email, type, twoFactorMethod }) => {
            setOtpParams({ email, type, twoFactorMethod });
            setCurrentStep('otp');
          }}
          onLoginSuccess={() => setCurrentStep('dashboard')}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          onNavigateToLogin={() => setCurrentStep('login')}
          onNavigateToOtp={({ email, type }) => {
            setOtpParams({ email, type });
            setCurrentStep('otp');
          }}
        />
      );

    case 'otp':
      return (
        <OtpScreen
          email={otpParams.email}
          type={otpParams.type}
          twoFactorMethod={otpParams.twoFactorMethod}
          onSuccess={() => setCurrentStep('dashboard')}
          onBackToLogin={() => setCurrentStep('login')}
        />
      );

    case 'forgot':
      return (
        <ForgotPasswordScreen
          onNavigateToReset={(email) => {
            setResetEmail(email);
            setCurrentStep('reset');
          }}
          onBackToLogin={() => setCurrentStep('login')}
        />
      );

    case 'reset':
      return (
        <ResetPasswordScreen
          email={resetEmail}
          onResetSuccess={() => setCurrentStep('login')}
          onBackToLogin={() => setCurrentStep('login')}
        />
      );

    default:
      return null;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <MainNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    width: '100%',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
});
