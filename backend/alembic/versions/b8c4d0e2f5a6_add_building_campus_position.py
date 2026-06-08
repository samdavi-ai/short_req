"""Add building campus position fields

Revision ID: b8c4d0e2f5a6
Revises: a7b3c9d1e2f4
Create Date: 2026-06-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'b8c4d0e2f5a6'
down_revision = 'a7b3c9d1e2f4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('buildings') as batch_op:
        batch_op.add_column(sa.Column('x_position', sa.Float(), server_default='0.0'))
        batch_op.add_column(sa.Column('y_position', sa.Float(), server_default='0.0'))
        batch_op.add_column(sa.Column('map_width', sa.Float(), server_default='200.0'))
        batch_op.add_column(sa.Column('map_height', sa.Float(), server_default='150.0'))

    # Spread existing buildings so they don't overlap
    conn = op.get_bind()
    buildings = conn.execute(sa.text("SELECT id FROM buildings ORDER BY id")).fetchall()
    for i, row in enumerate(buildings):
        x = (i % 4) * 250 + 100
        y = (i // 4) * 200 + 100
        conn.execute(sa.text(f"UPDATE buildings SET x_position = {x}, y_position = {y} WHERE id = {row[0]}"))


def downgrade() -> None:
    with op.batch_alter_table('buildings') as batch_op:
        batch_op.drop_column('map_height')
        batch_op.drop_column('map_width')
        batch_op.drop_column('y_position')
        batch_op.drop_column('x_position')
