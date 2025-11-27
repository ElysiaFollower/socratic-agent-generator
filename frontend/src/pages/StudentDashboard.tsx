import React, { useState, useEffect } from 'react';
import groupService from '../services/groupService';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import authService from '../services/authService';

const StudentDashboard: React.FC = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [tutors, setTutors] = useState([]);
  const { user, setUser } = useAuth();
  const [group, setGroup] = useState(null);

  useEffect(() => {
    if (user) {
      groupService.getUserGroup().then(
        (response) => {
          setGroup(response.data);
          if (response.data) {
            groupService.getGroupTutors(response.data.id).then(
              (response) => {
                setTutors(response.data);
              },
              (error) => {
                console.error('Failed to fetch tutors', error);
              }
            );
          }
        },
        (error) => {
          console.error('Failed to fetch group', error);
        }
      );
    }
  }, [user]);

  const handleJoinGroup = async () => {
    try {
      const response = await groupService.joinGroup(inviteCode);
      authService.updateUser(response.data);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to join group', error);
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Student Dashboard</h2>
      {group ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Group: {group.name}</CardTitle>
            <CardDescription>Available Tutors</CardDescription>
          </CardHeader>
          <CardContent>
            <ul>
              {tutors.map((tutor) => (
                <li key={tutor.id}>
                  {tutor.name} - {tutor.description}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Join a Group</CardTitle>
            <CardDescription>Enter an invite code to join a group.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input id="invite-code" type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleJoinGroup}>Join</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default StudentDashboard;
