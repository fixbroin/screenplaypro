"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, Eye, Trash2, Loader2, UserCircle, PackageSearch, ShieldCheck, ShieldAlert, XCircle, Search, Download, FileDown, UserCheck, UserX, UserPlus, Phone, Mail, Calendar, MessageCircle, ChevronDown, FileSpreadsheet, FileText as FilePdfIcon, CheckCircle2 } from "lucide-react";
import type { FirestoreUser, Address } from '@/types/firestore';
import { useToast } from "@/hooks/use-toast";
import UserDetailsModal from '@/components/admin/UserDetailsModal'; 
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppImage from '@/components/ui/AppImage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { sendAccountStatusEmail } from '@/ai/flows/sendAccountStatusEmailFlow';
import { getTimestampMillis } from '@/lib/utils';

const formatUserTimestamp = (timestamp?: any): string => {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return 'N/A';
  return new Date(millis).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const StatusBadge = ({ isActive, isLoading }: { isActive: boolean, isLoading: boolean }) => (
  <div className={cn(
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-sm",
    isActive 
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
      : "bg-destructive/10 text-destructive border-destructive/20"
  )}>
    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (isActive ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />)}
    <span>{isActive ? 'Active' : 'Disabled'}</span>
  </div>
);

type SelectableUserField = keyof Omit<FirestoreUser, 'addresses' | 'fcmTokens' | 'marketingStatus' | 'roles' | 'photoURL'> | 'fullAddress';

const availableFields: { key: SelectableUserField; label: string }[] = [
  { key: 'displayName', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'fullAddress', label: 'Primary Address' },
  { key: 'walletBalance', label: 'Wallet Balance' },
  { key: 'isActive', label: 'Status' },
  { key: 'createdAt', label: 'Creation Date' },
  { key: 'lastLoginAt', label: 'Last Login' },
];

export default function AdminUsersPage() {
  const { config: appConfig } = useApplicationConfig();
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedUserForModal, setSelectedUserForModal] = useState<FirestoreUser | null>(null);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [selectedFields, setSelectedFields] = useState<Partial<Record<SelectableUserField, boolean>>>({
    displayName: true, email: true, mobileNumber: true, fullAddress: false, 
    walletBalance: false, isActive: true, createdAt: false, lastLoginAt: false,
    id: false, uid: false,
  });

  const fetchUsersFromMySQL = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db/users');
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) {
        setUsers(json.users);
      }
    } catch (err) {
      console.error("Error fetching users from MySQL:", err);
      toast({ title: "Error", description: "Failed to load users from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsersFromMySQL();
  }, [fetchUsersFromMySQL]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    
    const lowerSearch = searchTerm.toLowerCase().trim();
    const normalizedSearchPhone = lowerSearch.replace(/\D/g, '').replace(/^91/, '');

    return users.filter(user => {
      const nameMatch = (user.displayName || '').toLowerCase().includes(lowerSearch);
      const emailMatch = (user.email || '').toLowerCase().includes(lowerSearch);
      
      const userPhone = (user.mobileNumber || '').replace(/\D/g, '').replace(/^91/, '');
      const phoneMatch = normalizedSearchPhone ? userPhone.includes(normalizedSearchPhone) : false;
      
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [users, searchTerm]);

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!userId) return;
    setIsUpdatingStatus(userId);
    try {
      const newStatus = !currentStatus;
      await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, isActive: newStatus ? 1 : 0 })
      });
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: newStatus } : u));
      await triggerRefresh('users');
      toast({ title: "Status Updated", description: `User is now ${newStatus ? 'Active' : 'Disabled'}.` });

      const targetUser = users.find(u => u.id === userId);
      if (targetUser && targetUser.email && appConfig?.smtpHost) {
        sendAccountStatusEmail({
          userName: targetUser.displayName || "User",
          userEmail: targetUser.email,
          status: newStatus ? 'activated' : 'disabled',
          smtpHost: appConfig.smtpHost,
          smtpPort: appConfig.smtpPort,
          smtpUser: appConfig.smtpUser,
          smtpPass: appConfig.smtpPass,
          senderEmail: appConfig.senderEmail,
          siteName: appConfig.siteName || "Screenplay Pro",
          logoUrl: appConfig.logoUrl,
        }).catch(err => {
          console.error("Failed to send status update email:", err);
        });
      }
    } catch (error) {
      toast({ title: "Update Failed", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) return;
    setIsDeleting(userId);
    try {
      await fetch(`/api/db/users?userId=${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
      await triggerRefresh('users');
      toast({ title: "User Deleted", description: "The record has been removed from MySQL." });
    } catch (error) {
      toast({ title: "Delete Failed", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };
  
  const handleViewDetails = (user: FirestoreUser) => {
    setSelectedUserForModal(user);
    setIsUserDetailsModalOpen(true);
  };

  const handleUpdateUserFromModal = async (updatedUserData: Partial<FirestoreUser>) => {
    if (!selectedUserForModal?.id) return false;
    try {
        await fetch('/api/db/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedUserForModal.id, ...updatedUserData })
        });
        
        setUsers(prev => prev.map(u => u.id === selectedUserForModal.id ? { ...u, ...updatedUserData } : u));
        await triggerRefresh('users');
        toast({ title: "Updated", description: "User details synchronized." });
        setIsUserDetailsModalOpen(false);
        return true;
    } catch (error) {
        toast({ title: "Update Failed", variant: "destructive" });
        return false;
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent, mobileNumber: string) => {
    e.stopPropagation();
    const sanitizedPhone = mobileNumber.replace(/\D/g, '');
    const internationalPhone = sanitizedPhone.startsWith('91') ? sanitizedPhone : `91${sanitizedPhone}`;
    const message = encodeURIComponent("Hi, I'm contacting you from Screenplay Pro.");
    window.open(`https://wa.me/${internationalPhone}?text=${message}`, '_blank');
  };

  const formatAddress = (address?: Address): string => {
    if (!address) return 'N/A';
    return `${address.addressLine1}, ${address.city}, ${address.state} - ${address.pincode}`;
  };

  const processDataForDownload = () => {
    const headers = availableFields.filter(f => selectedFields[f.key]).map(f => f.label);
    const keys = availableFields.filter(f => selectedFields[f.key]).map(f => f.key);
    return {
      headers,
      data: filteredUsers.map(user => keys.map(key => {
        if (key === 'fullAddress') return formatAddress(user.addresses?.[0]);
        if (key === 'isActive') return user.isActive ? 'Active' : 'Disabled';
        if (key === 'createdAt' || key === 'lastLoginAt') return formatUserTimestamp((user as any)[key]);
        return (user as any)[key] ?? 'N/A';
      }))
    };
  };

  const handleExportCSV = () => {
    const { headers, data } = processDataForDownload();
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      csvRows.push(row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setIsExportDialogOpen(false);
  };

  const handleExportExcel = () => {
    const { headers, data } = processDataForDownload();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportDialogOpen(false);
  };

  const handleExportPDF = () => {
    const { headers, data } = processDataForDownload();
    const doc = new jsPDF();
    (doc as any).autoTable({
      head: [headers],
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save(`users_export_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">View and manage registered user accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Export Users
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-secondary/20"
              />
            </div>
            <div className="text-xs text-muted-foreground font-semibold">
              Showing {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-bold text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-secondary/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.photoURL || undefined} />
                            <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm">{user.displayName || 'No Name'}</p>
                            <p className="text-xs text-muted-foreground">{user.email || 'No Email'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p className="flex items-center gap-1 font-medium">
                            <Phone className="h-3 w-3 text-muted-foreground" /> {user.mobileNumber || 'N/A'}
                            {user.mobileNumber && (
                              <button onClick={(e) => handleWhatsAppClick(e, user.mobileNumber!)} className="text-emerald-500 hover:text-emerald-600 ml-1">
                                <AppImage src="/whatsapp.png" alt="WA" width={14} height={14} />
                              </button>
                            )}
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" /> {user.email || 'N/A'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge isActive={!!user.isActive} isLoading={isUpdatingStatus === user.id} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatUserTimestamp(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(user)} title="View User Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleUserStatus(user.id, !!user.isActive)}
                          disabled={isUpdatingStatus === user.id}
                          title={user.isActive ? "Disable User" : "Activate User"}
                          className={user.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}
                        >
                          {isUpdatingStatus === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete User">
                              {isDeleting === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{user.displayName || user.email}</strong>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-destructive-foreground">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      {selectedUserForModal && isUserDetailsModalOpen && (
        <Dialog open={isUserDetailsModalOpen} onOpenChange={setIsUserDetailsModalOpen}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <UserDetailsModal
              user={selectedUserForModal}
              onClose={() => setIsUserDetailsModalOpen(false)}
              onUpdateUser={handleUpdateUserFromModal}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export User Data</DialogTitle>
            <DialogDescription>Select fields and file format to export.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              {availableFields.map(field => (
                <div key={field.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`field-${field.key}`}
                    checked={!!selectedFields[field.key]}
                    onCheckedChange={(checked) => setSelectedFields(prev => ({ ...prev, [field.key]: !!checked }))}
                  />
                  <Label htmlFor={`field-${field.key}`} className="text-xs font-semibold cursor-pointer">{field.label}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleExportCSV} className="flex-1" variant="outline"><FilePdfIcon className="mr-2 h-4 w-4" /> CSV</Button>
              <Button onClick={handleExportExcel} className="flex-1" variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
              <Button onClick={handleExportPDF} className="flex-1" variant="outline"><FilePdfIcon className="mr-2 h-4 w-4" /> PDF</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
