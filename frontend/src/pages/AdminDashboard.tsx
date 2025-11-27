import React, { useState, useEffect, useMemo } from 'react';
import userService from '../services/userService';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    userService.getUsers().then(
      (response) => {
        setUsers(response.data);
      },
      (error) => {
        console.error('Failed to fetch users', error);
      }
    );
  }, []);

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Admin Dashboard</h2>
      <Table>
        <TableCaption>A list of all the users in the system.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('username')}>
                Username <ArrowUpDown className="w-4 h-4 ml-2" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('email')}>
                Email <ArrowUpDown className="w-4 h-4 ml-2" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('role')}>
                Role <ArrowUpDown className="w-4 h-4 ml-2" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end mt-4">
        {Array.from({ length: Math.ceil(users.length / usersPerPage) }, (_, i) => (
          <Button key={i} onClick={() => paginate(i + 1)} variant={currentPage === i + 1 ? 'solid' : 'outline'}>
            {i + 1}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
