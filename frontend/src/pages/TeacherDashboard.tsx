import React, { useState } from 'react';
import axios from 'axios';
import authHeader from '../services/authHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_URL = '/api';

const TeacherDashboard: React.FC = () => {
  const [labManual, setLabManual] = useState<File | null>(null);
  const [labManualId, setLabManualId] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<any | null>(null);
  const [persona, setPersona] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLabManual(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!labManual) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const response = await axios.post(`${API_URL}/lab_manuals`, { content }, { headers: authHeader() });
        setLabManualId(response.data.lab_manual_id);
      } catch (error) {
        console.error('Failed to upload lab manual', error);
      }
    };
    reader.readAsText(labManual);
  };

  const handleGenerateCurriculum = async () => {
    if (!labManualId) return;
    try {
      const response = await axios.post(`${API_URL}/curricula`, { lab_manual_id: labManualId }, { headers: authHeader() });
      setCurriculum(response.data);
    } catch (error) {
      console.error('Failed to generate curriculum', error);
    }
  };

  const handleGeneratePersona = async () => {
    if (!labManualId) return;
    try {
      const response = await axios.post(`${API_URL}/personas`, { lab_manual_id: labManualId }, { headers: authHeader() });
      setPersona(response.data);
    } catch (error) {
      console.error('Failed to generate persona', error);
    }
  };

  const handleCompileProfile = async () => {
    if (!curriculum || !persona) return;
    try {
      const response = await axios.post(`${API_URL}/profiles`, { curriculum_id: curriculum.curriculum_id, persona_id: persona.persona_id, profile_name: 'New Profile' }, { headers: authHeader() });
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to compile profile', error);
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Teacher Dashboard</h2>
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload Lab Manual</TabsTrigger>
          <TabsTrigger value="generate" disabled={!labManualId}>Generate Assets</TabsTrigger>
          <TabsTrigger value="compile" disabled={!curriculum || !persona}>Compile Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Lab Manual</CardTitle>
              <CardDescription>Upload a lab manual to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="lab-manual">Lab Manual</Label>
                <Input id="lab-manual" type="file" onChange={handleFileChange} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpload}>Upload</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate Assets</CardTitle>
              <CardDescription>Generate a curriculum and persona from the lab manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Button onClick={handleGenerateCurriculum}>Generate Curriculum</Button>
                {curriculum && <p className="mt-2 text-sm text-gray-500">Curriculum generated!</p>}
              </div>
              <div>
                <Button onClick={handleGeneratePersona}>Generate Persona</Button>
                {persona && <p className="mt-2 text-sm text-gray-500">Persona generated!</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="compile">
          <Card>
            <CardHeader>
              <CardTitle>Compile Profile</CardTitle>
              <CardDescription>Compile a profile from the generated curriculum and persona.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCompileProfile}>Compile Profile</Button>
              {profile && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">Profile Compiled</h3>
                  <pre className="p-4 mt-2 bg-gray-100 rounded-md">{JSON.stringify(profile, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeacherDashboard;
