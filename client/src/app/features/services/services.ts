import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms';

interface ServiceItem {
  id: string;
  title: string;
  icon: string;
  description: string;
  tags: string[];
}

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.html',
})
export class Services {
  private readonly toast = inject(ToastService);
  searchQuery = '';

  readonly services: ServiceItem[] = [
    {
      id: 'gst',
      title: 'GST Services',
      icon: 'receipt_long',
      description: 'Comprehensive GST solutions including Registration, Return Filing, and Refund processing to ensure seamless compliance.',
      tags: ['Registration', 'Return Filing', 'Refund']
    },
    {
      id: 'income-tax',
      title: 'Income Tax',
      icon: 'account_balance_wallet',
      description: 'Expert ITR Filing, Strategic Tax Planning, and meticulous TDS management optimized for individuals and corporate entities.',
      tags: ['ITR Filing', 'Tax Planning', 'TDS']
    },
    {
      id: 'mutual-funds',
      title: 'Mutual Funds',
      icon: 'trending_up',
      description: 'Tailored investment strategies through SIPs and Lump Sum allocations aligned with your specific long-term goals.',
      tags: ['SIP', 'Lump Sum', 'Goal Planning']
    },
    {
      id: 'loans',
      title: 'Loan Services',
      icon: 'real_estate_agent',
      description: 'Streamlined processing and advisory for Home, Personal, and Business Loans to secure optimal financing terms.',
      tags: ['Home', 'Personal', 'Business']
    },
    {
      id: 'insurance',
      title: 'Insurance',
      icon: 'health_and_safety',
      description: 'Risk mitigation through structured Life, Health, and General Insurance policies tailored to protect your assets.',
      tags: ['Life', 'Health', 'General']
    },
    {
      id: 'financial-planning',
      title: 'Financial Planning',
      icon: 'pie_chart',
      description: 'Holistic approaches to Wealth Creation and Retirement Planning ensuring sustained financial stability and growth.',
      tags: ['Wealth Creation', 'Retirement']
    },
    {
      id: 'company-incorporation',
      title: 'Company Incorporation',
      icon: 'business',
      description: 'End-to-end assistance with entity formation, ROC Filing, and ongoing regulatory compliance frameworks.',
      tags: ['ROC Filing', 'Compliance']
    },
    {
      id: 'audit',
      title: 'Audit & Assurance',
      icon: 'fact_check',
      description: 'Rigorous Internal and Statutory Audits designed to enhance operational transparency and financial fidelity.',
      tags: ['Internal Audit', 'Statutory Audit']
    }
  ];

  get filteredServices() {
    const query = this.searchQuery.toLowerCase();
    return this.services.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query) ||
      s.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  onServiceClick() {
    this.toast.show('This feature is coming soon...', 'info');
  }
}
