'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Info } from 'lucide-react';

// Issuer configuration - these map to the file format handlers
const ISSUERS = [
  {
    key: 'MAX',
    displayKey: 'Max',
    defaultName: 'Max',
    fileFormat: 'max',
    description: 'Discount Bank Max card format'
  },
  {
    key: 'VISA-CAL',
    displayKey: 'Visa / Cal',
    defaultName: 'Visa / Cal',
    fileFormat: 'visa-cal',
    description: 'Visa / Cal format'
  },
  {
    key: 'ISRACARD',
    displayKey: 'Isracard',
    defaultName: 'Isracard / Amex',
    fileFormat: 'isracard',
    description: 'Isracard and American Express format'
  }
];

export default function IssuersPage() {
  // Load from localStorage or use defaults
  const [issuerNames, setIssuerNames] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('issuerNames');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return ISSUERS.reduce((acc, issuer) => {
      acc[issuer.key] = issuer.defaultName;
      return acc;
    }, {} as Record<string, string>);
  });

  const handleSave = () => {
    localStorage.setItem('issuerNames', JSON.stringify(issuerNames));
    toast.success('Issuer names saved successfully');
  };

  const handleReset = () => {
    const defaults = ISSUERS.reduce((acc, issuer) => {
      acc[issuer.key] = issuer.defaultName;
      return acc;
    }, {} as Record<string, string>);
    setIssuerNames(defaults);
    localStorage.setItem('issuerNames', JSON.stringify(defaults));
    toast.success('Reset to default names');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Card Issuers</h1>
        <p className="text-gray-500 mt-1">Customize display names for card issuers</p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            About Issuer Names
          </CardTitle>
          <CardDescription>
            These display names appear in dropdowns and card lists. The internal file format handlers remain unchanged.
            Changes are saved locally in your browser.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {ISSUERS.map((issuer) => (
          <Card key={issuer.key}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div>
                  <Label htmlFor={issuer.key} className="text-base font-semibold">
                    {issuer.displayKey}
                  </Label>
                  <p className="text-sm text-gray-500">{issuer.description}</p>
                  <p className="text-xs text-gray-400 mt-1">File format: {issuer.fileFormat}</p>
                </div>
                <div>
                  <Label htmlFor={`input-${issuer.key}`} className="text-sm">Display Name</Label>
                  <Input
                    id={`input-${issuer.key}`}
                    value={issuerNames[issuer.key] || issuer.defaultName}
                    onChange={(e) => setIssuerNames(prev => ({
                      ...prev,
                      [issuer.key]: e.target.value
                    }))}
                    placeholder={issuer.defaultName}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
