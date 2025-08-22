'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '../components/Login';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const user = localStorage.getItem('user');
    if (user) {
      router.push('/dashboard');
    }
  }, [router]);

  return <Login />;
}