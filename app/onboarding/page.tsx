'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCountries } from '@yusifaliyevpro/countries';
import Image from 'next/image';

type CountryDropdownOption = { name: string; cca2: string; flag: string };

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [countryList, setCountryList] = useState<CountryDropdownOption[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    getCountries({
      fields: ['name', 'flag', 'cca2'],
    }).then((list) => {
      if (Array.isArray(list)) {
        const parsed = list.map((c) => ({
          name: c.name.common,
          cca2: c.cca2,
          flag: c.flag,
        }));
        parsed.sort((a, b) => a.name.localeCompare(b.name));
        setCountryList(parsed);
      }
    });
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user?.email) return;
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setName(data.name || '');
        setParentEmail(data.parentEmail || '');
        setCountry(data.country || '');
      }
      setLoadingProfile(false);
    }
    if (session) fetchProfile();
  }, [session]);

  const selectedCountry = countryList.find((c) => c.name === country);

  if (status === 'loading' || loadingProfile) return <div>Loading...</div>;
  if (!session) {
    router.replace('/auth/signin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentEmail, country }),
      });
      const data = await res.json();
      if (res.ok) {
        // After onboarding, take the user to the student dashboard
        window.location.replace('/student-home-dashboard');
      } else {
        setError(data.error || 'Failed to save. Please try again.');
        setSaving(false);
      }
    } catch (err) {
      setError('Network error');
      setSaving(false);
      console.log(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-12 space-y-4">
      <h1 className="text-xl font-bold">Complete your profile</h1>
      <input
        type="text"
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <input
        type="email"
        required
        placeholder="Parent's email"
        value={parentEmail}
        onChange={(e) => setParentEmail(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <div className="flex items-center gap-2">
        {selectedCountry && (
          <span
            style={{
              background: 'white',
              borderRadius: '4px',
              padding: '2px 4px',
              display: 'inline-block',
            }}
          >
            <Image
              src={`https://flagcdn.com/48x36/${selectedCountry.cca2.toLowerCase()}.png`}
              alt={selectedCountry.name + ' flag'}
              width={32}
              height={24}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </span>
        )}
        <select
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Select your country</option>
          {countryList.map((c) => (
            <option key={c.cca2} value={c.name}>
              {c.name} ({c.cca2})
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </form>
  );
}
