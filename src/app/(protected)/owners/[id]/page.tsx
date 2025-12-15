'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Users, 
  Mail, 
  MapPin, 
  Building, 
  Home, 
  Calendar, 
  ArrowLeft,
  DollarSign,
  User,
  Building2,
  CreditCard,
  BarChart3,
  FileText,
  Phone,
  ExternalLink,
  Copy,
  Download,
  Share2,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Wallet,
  FileSpreadsheet,
  Settings,
  Plus,
  MessageSquare,
  Activity,
  Star,
  FileCheck,
  Send,
  Eye,
  CalendarDays,
  Tag,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  RefreshCw,
  Bell,
  Settings2,
  Shield,
  CreditCard as CreditCardIcon,
  FileText as FileTextIcon,
  PieChart,
  LineChart,
  BarChart,
  DollarSign as DollarSignIcon,
  Receipt,
  Calculator,
  Archive,
  Trash2,
  Edit3,
  Save,
  X,
  Info,
  HelpCircle,
  Zap,
  Target,
  Award,
  Heart,
  ThumbsUp,
  MessageCircle,
  Video,
  Camera,
  Mic,
  Paperclip,
  Smile,
  Frown,
  Meh,
  TrendingDown
} from 'lucide-react'
import EditLink from '@/components/ui/EditLink'
import EditOwnerModal, { type OwnerModalData } from '@/components/EditOwnerModal'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Database } from '@/types/database'
import { toast } from 'sonner'

type Country = Database['public']['Enums']['countries']

interface Owner {
  id: string
  contact_id: number
  displayName: string
  is_company: boolean
  first_name?: string
  last_name?: string
  company_name?: string
  primary_email?: string
  primary_phone?: string
  primary_address_line_1?: string
  primary_address_line_2?: string
  primary_city?: string
  primary_state?: string
  primary_postal_code?: string
  primary_country?: Country | null
  management_agreement_start_date?: string
  management_agreement_end_date?: string
  created_at: string
  updated_at: string
  total_units?: number
  // Additional fields for details page
  alt_email?: string
  alt_phone?: string
  date_of_birth?: string
  comment?: string
  tax_payer_id?: string
  tax_payer_type?: string
  tax_payer_name?: string
  tax_address_line1?: string
  tax_address_line2?: string
  tax_city?: string
  tax_state?: string
  tax_postal_code?: string
  tax_country?: Country | null
  // ETF Account Information
  etf_account_type?: 'Checking' | 'Saving' | null
  etf_account_number?: number | null
  etf_routing_number?: number | null
  // Status and preferences
  status?: 'active' | 'inactive'
  preferred_contact_method?: 'email' | 'phone' | 'text'
  email_opt_in?: boolean
  text_opt_in?: boolean
  referral_source?: string
  loyalty_tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  client_since?: string
  last_contact_date?: string
  notes?: string
}

interface Property {
  id: string
  name: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  total_units: number
  status: string
  ownership_percentage: number
  disbursement_percentage: number
  primary: boolean
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  category: string
  reference: string
}

interface Document {
  id: string
  name: string
  type: string
  uploaded_at: string
  size: string
  url: string
}

interface Communication {
  id: string
  date: string
  type: 'email' | 'text' | 'call'
  subject: string
  content: string
  status: 'sent' | 'delivered' | 'read'
}

interface Task {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed'
  due_date: string
  assigned_to: string
}

interface FinancialSummary {
  total_balance: number
  ytd_disbursements: number
  pending_amount: number
  last_1099_issued?: string
  total_properties: number
  total_units: number
}

const maskLastFour = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D+/g, '')
  if (!digits) return null
  const lastFour = digits.slice(-4)
  return `••••${lastFour}`
}

// Helper function to convert Owner to OwnerModalData
function ownerToModalData(owner: Owner): OwnerModalData {
  return {
    id: owner.id,
    contact_id: owner.contact_id,
    management_agreement_start_date: owner.management_agreement_start_date,
    management_agreement_end_date: owner.management_agreement_end_date,
    comment: owner.comment,
    etf_account_type: owner.etf_account_type,
    etf_account_number: owner.etf_account_number,
    etf_routing_number: owner.etf_routing_number,
    created_at: owner.created_at,
    updated_at: owner.updated_at
  }
}

export default function OwnerDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const ownerId = params.id as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  
  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false)
  const [updateOwnerError, setUpdateOwnerError] = useState<string | null>(null)
  
  // Communication state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showTextModal, setShowTextModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  
  // Quick actions state
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSendingText, setIsSendingText] = useState(false)
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false)

  const fetchOwnerDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/owners/${ownerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch owner details')
      }
      
      const data = await response.json()
      setOwner(data)
      
      // Fetch all related data in parallel
      await Promise.all([
        fetchOwnerProperties(),
        fetchTransactions(),
        fetchDocuments(),
        fetchCommunications(),
        fetchTasks(),
        fetchFinancialSummary()
      ])
    } catch (error) {
      console.error('Error fetching owner details:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch owner details')
    } finally {
      setLoading(false)
    }
  }

  const fetchOwnerProperties = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/properties`)
      if (response.ok) {
        const data = await response.json()
        setProperties(data)
      }
    } catch (error) {
      console.error('Error fetching owner properties:', error)
      // Don't set error here as it's not critical for the main page
    }
  }

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/transactions`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const fetchCommunications = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/communications`)
      if (response.ok) {
        const data = await response.json()
        setCommunications(data)
      }
    } catch (error) {
      console.error('Error fetching communications:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/tasks`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchFinancialSummary = async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/financial-summary`)
      if (response.ok) {
        const data = await response.json()
        setFinancialSummary(data)
      }
    } catch (error) {
      console.error('Error fetching financial summary:', error)
    }
  }

  const handleEditOwner = async (ownerData: any) => {
    try {
      setIsUpdatingOwner(true)
      setUpdateOwnerError(null)
      
      const response = await fetch(`/api/owners/${ownerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ownerData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update owner')
      }
      
      const updatedOwner = await response.json()
      setOwner(updatedOwner)
      setShowEditModal(false)
    } catch (error) {
      console.error('Error updating owner:', error)
      setUpdateOwnerError(error instanceof Error ? error.message : 'Failed to update owner')
    } finally {
      setIsUpdatingOwner(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20'
      case 'inactive': return 'bg-muted text-muted-foreground'
      case 'pending': return 'bg-warning/10 text-warning border-warning/20'
      case 'completed': return 'bg-success/10 text-success border-success/20'
      case 'overdue': return 'bg-destructive/10 text-destructive border-destructive/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20'
      case 'medium': return 'bg-warning/10 text-warning border-warning/20'
      case 'low': return 'bg-success/10 text-success border-success/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getLoyaltyTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'silver': return 'bg-muted text-foreground border-border'
      case 'bronze': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const handleQuickEmail = async () => {
    setIsSendingEmail(true)
    try {
      toast.info('Owner email send is not wired yet', {
        description: 'We will hook this action to the messaging service soon.',
      })
    } catch (error) {
      console.error('Error sending email:', error)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleQuickText = async () => {
    setIsSendingText(true)
    try {
      toast.info('Owner text send is not available yet', {
        description: 'SMS support will be added after messaging backend is ready.',
      })
    } catch (error) {
      console.error('Error sending text:', error)
    } finally {
      setIsSendingText(false)
    }
  }

  const handleGenerateStatement = async () => {
    setIsGeneratingStatement(true)
    try {
      toast.info('Owner statement generation is coming soon', {
        description: 'Statements will be generated once the finance service is connected.',
      })
    } catch (error) {
      console.error('Error generating statement:', error)
    } finally {
      setIsGeneratingStatement(false)
    }
  }

  useEffect(() => {
    if (ownerId) {
      fetchOwnerDetails()
    }
  }, [ownerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading owner details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Owners</span>
            </button>
          </div>
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to Load Owner</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={fetchOwnerDetails}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Owners</span>
            </button>
          </div>
          <div className="text-center py-12">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Owner Not Found</h2>
            <p className="text-muted-foreground">The requested owner could not be found.</p>
          </div>
        </div>
      </div>
    )
  }

  const totalUnits = properties.reduce((sum, property) => sum + property.total_units, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-8 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/owners" className="hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span>Owners</span>
            <span>/</span>
            <span className="text-foreground font-medium">{owner.displayName}</span>
          </div>

          {/* Owner Profile */}
          <div className="flex items-start gap-6 mb-8">
            {/* Avatar */}
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-semibold">
              {owner.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            
            {/* Owner Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-foreground">{owner.displayName}</h1>
                <span className="px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-full">
                  Active
                </span>
              </div>
              
              {/* Owner Details Line */}
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  Individual
                </span>
                <span>{properties.length} Properties • {totalUnits} Units</span>
                <span>Last contact {formatDate(owner.updated_at)}</span>
              </div>
            </div>

            {/* Edit Button */}
            <EditLink onClick={() => setShowEditModal(true)} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border px-8 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted border border-border rounded-full p-1 h-auto w-full justify-start gap-1">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <Users className="w-4 h-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger 
              value="financials" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <DollarSign className="w-4 h-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger 
              value="properties" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <Building2 className="w-4 h-4" />
              Properties ({properties.length})
            </TabsTrigger>
            <TabsTrigger 
              value="communications" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <FileText className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="overview" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-3 space-y-6">
                {/* Rental owner information */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-lg font-medium text-foreground">Rental owner information</h2>
                    <EditLink aria-label="Edit rental owner information" />
                  </div>
                  
                  {/* 3-Column Layout for Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Email Column */}
                    <div>
                      <h3 className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">EMAIL:</h3>
                      <div className="space-y-2">
                        {owner.primary_email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{owner.primary_email}</span>
                            <button 
                              onClick={() => copyToClipboard(owner.primary_email!)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Copy email to clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {owner.alt_email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{owner.alt_email}</span>
                            <button 
                              onClick={() => copyToClipboard(owner.alt_email!)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Copy alternate email to clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {owner.email_opt_in && (
                          <div className="mt-2">
                            <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">
                              Opted In
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Phone Column */}
                    <div>
                      <h3 className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">PHONE:</h3>
                      <div className="space-y-2">
                        {owner.primary_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{owner.primary_phone}</span>
                          </div>
                        )}
                        {!owner.text_opt_in && (
                          <div className="mt-2">
                            <span className="px-2 py-1 bg-muted text-muted-foreground text-xs font-medium rounded">
                              Text Messaging Disabled
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Address Column */}
                    <div>
                      <h3 className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">ADDRESS:</h3>
                      <div className="space-y-1">
                        {owner.primary_address_line_1 ? (
                          <>
                            <div className="text-sm text-foreground">{owner.primary_address_line_1}</div>
                            {owner.primary_address_line_2 && <div className="text-sm text-foreground">{owner.primary_address_line_2}</div>}
                            <div className="text-sm text-foreground">{owner.primary_city}, {owner.primary_state} {owner.primary_postal_code}</div>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">No address</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full-width rows for Date of Birth and Comments */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">DATE OF BIRTH:</h3>
                      <div className="text-sm text-foreground">
                        {owner.date_of_birth ? formatDate(owner.date_of_birth) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">COMMENTS:</h3>
                      <div className="text-sm text-foreground">
                        {owner.comment || <span className="text-muted-foreground">No comments</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Management Agreement */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-lg font-medium text-foreground">Management Agreement</h2>
                    <EditLink aria-label="Edit management agreement" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {owner.management_agreement_start_date ? (
                            formatDate(owner.management_agreement_start_date)
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">End Date</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {owner.management_agreement_end_date ? (
                            formatDate(owner.management_agreement_end_date)
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-lg font-medium text-foreground">Banking Information</h2>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">
                        EFT Enabled
                      </span>
                      <EditLink aria-label="Edit banking information" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                      <div className="mt-1 text-sm text-foreground">
                        {owner.etf_account_type || <span className="text-muted-foreground">Not set</span>}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                      <div className="mt-1 text-sm text-foreground">
                        {maskLastFour(owner.etf_account_number) ?? (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Routing Number</label>
                      <div className="mt-1 text-sm text-foreground">
                        {maskLastFour(owner.etf_routing_number) ?? (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tax Profile */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-foreground">Tax Profile</h2>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <button className="text-destructive hover:underline transition-colors font-medium text-sm">
                        Required - Complete Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Recent Activity */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border shadow-sm p-6">
                  <h3 className="text-lg font-medium text-foreground mb-6">Recent Activity</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-primary/10">
                        Edit
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">Owner information updated</div>
                        <div className="text-xs text-muted-foreground">{formatDate(owner.updated_at)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-success/10">
                        <Building2 className="h-4 w-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">Property added</div>
                        <div className="text-xs text-muted-foreground">2 days ago</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-warning/10">
                        <DollarSign className="h-4 w-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">Monthly statement generated</div>
                        <div className="text-xs text-muted-foreground">1 week ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Owner Modal */}
      <EditOwnerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdateOwner={handleEditOwner}
        ownerData={owner ? ownerToModalData(owner) : null}
        isUpdating={isUpdatingOwner}
      />
    </div>
  )
}
