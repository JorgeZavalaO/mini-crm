'use client';

import { MonitorCog, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ThemeOption = 'system' | 'light' | 'dark';

const themeOptions: Array<{
  value: ThemeOption;
  label: string;
  description: string;
}> = [
  { value: 'system', label: 'Sistema', description: 'Sigue la configuración del dispositivo.' },
  { value: 'light', label: 'Claro', description: 'Interfaz con fondo claro.' },
  { value: 'dark', label: 'Oscuro', description: 'Interfaz con fondo oscuro.' },
];

export function ThemePreferencesCard() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();

  const selectedTheme = (theme ?? 'system') as ThemeOption;

  const activeLabel =
    selectedTheme === 'system'
      ? systemTheme === 'dark'
        ? 'Sistema (oscuro)'
        : 'Sistema (claro)'
      : resolvedTheme === 'dark'
        ? 'Oscuro'
        : 'Claro';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorCog />
          Preferencias
        </CardTitle>
        <CardDescription>Personaliza la apariencia visual de tu panel.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="theme-select">Tema</Label>
          <Select
            value={selectedTheme}
            onValueChange={(value) => {
              setTheme(value as ThemeOption);
            }}
          >
            <SelectTrigger id="theme-select" aria-label="Seleccionar tema">
              <SelectValue placeholder="Selecciona un tema" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="inline-flex items-center gap-2">
                      {option.value === 'light' ? <Sun /> : null}
                      {option.value === 'dark' ? <Moon /> : null}
                      {option.value === 'system' ? <MonitorCog /> : null}
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">Tema aplicado actualmente</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{activeLabel}</Badge>
            <p className="text-xs text-muted-foreground">
              {themeOptions.find((option) => option.value === selectedTheme)?.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
